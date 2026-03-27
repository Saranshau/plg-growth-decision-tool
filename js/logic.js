/**
 * logic.js — PLG Growth Decision Tool analysis engine.
 * Pure functions only. No DOM dependencies.
 */

// ── Thresholds ─────────────────────────────────────────────────────────────────

const T = {
  conversionCritical: 7,   // < 7%  = likely a product-value problem, not a funnel problem
  conversionLow:      10,  // < 10% = activation or monetisation problem
  conversionStrong:   20,  // ≥ 20% = conversion engine working
  activationSevere:   25,  // < 25% = product isn't delivering value in the trial window
  activationWeak:     35,  // < 35% = activation exists but is unreliable
  activationGood:     55,  // ≥ 55% = strong activation; if conversion still low, it's monetisation
  salesLeaning:       40,  // > 40% = sales-leaning; show supplementary flag
  salesDriven:        55,  // > 55% = sales is doing the PLG motion's job
  trialsLow:          300, // < 300/mo = low volume for a proven conversion engine
  acvLow:             75,  // < $75/mo = must be self-serve; sales touches hurt margin
  acvHigh:            300, // ≥ $300/mo = mid-market+; some sales assist is commercially fine
};

// ── Internal helpers ───────────────────────────────────────────────────────────

function acvTier(dealSize) {
  if (dealSize < T.acvLow)  return 'low';
  if (dealSize < T.acvHigh) return 'mid';
  return 'high';
}

function usd(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}


// ── Diagnosis definitions ──────────────────────────────────────────────────────
// Each diagnosis exposes three functions that receive the user's raw inputs
// and return context-specific text. No static strings — everything references
// the user's numbers, surfaces trade-offs, and gives sequenced advice.

const DIAGNOSIS = {

  // ── 1. Product-Value Gap ─────────────────────────────────────────────────────
  // Triggered when: conversion critically low AND activation very low (or missing)
  // Signal: the product isn't delivering a compelling enough value moment in the trial.
  // This is more fundamental than an onboarding or pricing fix.

  productValueGap: {
    id: 'productValueGap',
    label: 'Product-Value Gap',
    color: 'red',

    getText(inputs) {
      const { conversionRate, activationRate, trials, dealSize, salesAssistedPct } = inputs;
      const tier = acvTier(dealSize);
      const activationLine = activationRate != null
        ? `Your activation rate of ${activationRate}% means roughly ${Math.round(trials * activationRate / 100).toLocaleString()} users/month are reaching what you've defined as core value — and still not converting. Either the activation event is wrong (it doesn't represent genuine value), or the product delivers value that users don't feel is worth paying for.`
        : `Without activation data it's hard to be precise, but at ${conversionRate}% conversion across ${trials.toLocaleString()} trials, the trial window almost certainly isn't delivering a compelling enough value moment for most users.`;
      const tierLine = tier === 'low'
        ? `At ${usd(dealSize)}/mo, you need self-serve conversion to work at volume — there's no ACV to compensate with sales economics.`
        : tier === 'high'
        ? `At ${usd(dealSize)}/mo, a ${conversionRate}% conversion rate is hard to rescue with sales touches alone; the unit economics don't justify it at this trial volume.`
        : `At ${usd(dealSize)}/mo, sales touches can recover individual deals, but they're a workaround — not a structural fix.`;
      const salesIronyLine = salesAssistedPct != null && salesAssistedPct > 40
        ? ` The data has a sharp edge here: ${salesAssistedPct}% of your conversions require sales involvement, yet the overall rate is still only ${conversionRate}%. Your PLG motion isn't closing deals self-serve — and your sales team is struggling to close them too. That combination rules out a funnel or pricing fix. The product itself needs to change.`
        : '';
      return `${conversionRate}% conversion is not a funnel optimisation problem. It's a signal that most users aren't experiencing enough value during the trial to justify paying. ${activationLine} ${tierLine}${salesIronyLine} Investing in acquisition or conversion tactics at this stage will cost you more than it returns — the bottleneck is upstream of both.`;
    },

    getRecommendation() {
      return 'Establish genuine product-market fit within the trial window before optimising acquisition or pricing — no downstream lever can compensate for value that isn\'t being felt.';
    },

    getActions(inputs) {
      return [
        {
          title: 'Run a Jobs-to-be-Done study with your last 10 paying customers',
          body: 'Ask paying customers: "What were you trying to accomplish when you signed up, and what made you decide to pay?" Then compare their answers to what your current onboarding flow actually does. The gap between those two things is your diagnosis. This single exercise usually surfaces 2–3 positioning or product changes that no analytics dashboard will show you.',
        },
        {
          title: 'Pull session recordings for trials active past day 10 that didn\'t convert',
          body: 'Use Hotjar, FullStory, or LogRocket to watch 10 sessions of users who were active late in the trial but churned without paying. These users were motivated — something stopped them. Look for repeated friction, confusion on the same screen, or moments where they clearly wanted to do something the product didn\'t let them do easily. These sessions are your highest-signal qualitative data.',
        },
        {
          title: 'Redefine your activation event against actual conversion data — not intuition',
          body: 'Plot which in-product actions correlate with paid conversion in your existing customer base. If your current activation event doesn\'t predict conversion, you\'ve defined it wrong — you\'re measuring a behaviour, not a value moment. Redefine it as the action that best separates customers from churners, then measure what % of current trials actually reach it within 7 days.',
        },
      ];
    },
  },


  // ── 2. Activation Bottleneck ─────────────────────────────────────────────────
  // Triggered when: conversion low AND activation weak (25–35%)
  // Signal: users are getting close to value but not reliably reaching it.
  // The fix is a focused product change, not a marketing one.

  activationLeak: {
    id: 'activationLeak',
    label: 'Activation Bottleneck',
    color: 'red',

    getText(inputs) {
      const { conversionRate, activationRate, trials, dealSize } = inputs;
      const activatedUsers = Math.round(trials * activationRate / 100);
      const potentialNewCust = Math.round(activatedUsers * 0.30);
      const potentialMRR = usd(potentialNewCust * dealSize);
      return `Your activation rate of ${activationRate}% is the primary constraint — only ${activatedUsers.toLocaleString()} of your ${trials.toLocaleString()} monthly trials are reaching core value. Even at a conservative 30% conversion rate among activated users, closing that activation gap could generate ~${potentialMRR}/mo in additional MRR without touching acquisition at all. Your ${conversionRate}% overall conversion rate is a downstream symptom: you\'re measuring the output of a funnel where most users exit before they\'ve experienced what they\'re supposed to be paying for. The root cause is almost always speed — users are hitting friction or cognitive overhead before they reach the value moment, and they leave before getting there.`;
    },

    getRecommendation() {
      return 'Every point of activation improvement compounds directly into conversion — this is the single highest-leverage fix in your funnel right now.';
    },

    getActions(inputs) {
      const { activationRate, trials } = inputs;
      const nonActivating = Math.round(trials * (1 - activationRate / 100));
      return [
        {
          title: 'Measure time-to-activate, not just activation rate',
          body: 'Knowing that 30% activate isn\'t enough — you need to know when. If median time-to-activate is more than 3 days, users are churning before they reach value. Instrument the time from signup to your activation event, set a target (most high-converting PLG products reach value within one session), and work backwards from that goal. Speed to value is usually a bigger lever than the activation rate itself.',
        },
        {
          title: 'Find the single biggest drop-off step and fix it before touching anything else',
          body: `Pull your step-by-step funnel analytics from signup to activation event. Find the one step with the highest exit rate — don\'t try to fix the whole flow at once. Roughly ${nonActivating.toLocaleString()} users/month are not activating; even moving 20% of them through the worst step is a material gain. The culprit is usually a setup requirement, a permissions request, or a configuration step that feels mandatory but can be deferred or eliminated entirely.`,
        },
        {
          title: 'Build a "quick win" path for users who won\'t complete full setup upfront',
          body: 'Many users won\'t invest in full product setup until they\'ve seen genuine value. Build a lightweight demo mode or a pre-populated template that lets users experience the core value moment with zero configuration. Users who see value in the first session complete setup later — users who hit setup first often churn before they ever see what the product actually does.',
        },
      ];
    },
  },


  // ── 3. Value Capture Problem ─────────────────────────────────────────────────
  // Triggered when: conversion low AND activation high (≥55%)
  // Signal: the product delivers real value on the free tier, but users have no
  // compelling reason to pay. The free/paid boundary is misaligned.

  freeTooGood: {
    id: 'freeTooGood',
    label: 'Value Capture Problem',
    color: 'amber',

    getText(inputs) {
      const { conversionRate, activationRate, trials, dealSize } = inputs;
      const tier = acvTier(dealSize);
      const tierLine = tier === 'low'
        ? `At ${usd(dealSize)}/mo, users won\'t upgrade unless they hit a clear limit or feature gap — the free product needs a deliberate ceiling that creates genuine upgrade pressure.`
        : `At ${usd(dealSize)}/mo, an activated user should be evaluating the upgrade seriously. If ${conversionRate}% are converting, the free product is almost certainly removing the primary reason to pay.`;
      return `An activation rate of ${activationRate}% with a ${conversionRate}% conversion rate is an unusual and expensive combination — ${activationRate}% of users experience genuine value, but only ${conversionRate}% pay for it. This isn\'t a marketing or onboarding problem. The free product is delivering the core value without requiring an upgrade. ${tierLine} The question isn\'t how to get more users to value — it\'s where you\'ve drawn the line between free and paid, and whether that line is in the right place.`;
    },

    getRecommendation(inputs) {
      const tier = acvTier(inputs.dealSize);
      if (tier === 'low') {
        return 'Redesign your free/paid boundary — your current feature gates don\'t create natural upgrade pressure at a point that matters to users.';
      }
      return 'Audit what value you\'re giving away for free — the gap between activation and conversion suggests your free tier removes the primary reason to upgrade.';
    },

    getActions(inputs) {
      const { dealSize, activationRate } = inputs;
      return [
        {
          title: 'Map which activated behaviours predict paid conversion — then gate the right ones',
          body: 'Pull your cohort data: which specific in-product actions do paying customers take in their trial that non-converting users don\'t? Those actions represent genuine value moments. If they\'re currently available on the free tier with no friction or limit, you\'ve found your gate. Not every valuable feature should be free — the product strategy question is which features generate upgrade pressure vs. which build the habit that makes the upgrade worthwhile.',
        },
        {
          title: 'Run willingness-to-pay research — not just a pricing survey',
          body: 'Ask 10 highly activated trial users: "If you had to pay for this product starting today, what would you pay for and what would you cut?" Their answers will show you which features carry genuine commercial value and which are just nice-to-have. Price to the former. Give away the latter. Most SaaS companies discover their free tier includes their most commercially valuable features, and their paid tier gates things users don\'t actually value.',
        },
        {
          title: 'Move your upgrade trigger to the moment of maximum value — not trial expiry',
          body: `The best upgrade moment is immediately after a user experiences peak value and wants more of it — not when the trial clock runs out. Map the exact in-product moment where activated users derive the most benefit, then introduce a natural ceiling or upgrade CTA there. At ${usd(dealSize)}/mo this should feel like a logical next step, not a paywall — but it needs to exist at the value moment, not three weeks later.`,
        },
      ];
    },
  },


  // ── 4. Monetisation Gap ──────────────────────────────────────────────────────
  // Triggered when: conversion low AND activation functional (35–55%)
  // Signal: product-market fit is working at the activation level, but the revenue
  // architecture that should follow product engagement isn't firing.

  monetisationBlock: {
    id: 'monetisationBlock',
    label: 'Monetisation Gap',
    color: 'amber',

    getText(inputs) {
      const { conversionRate, activationRate, trials, dealSize, salesAssistedPct } = inputs;
      const activatedUsers = Math.round(trials * activationRate / 100);
      const tier = acvTier(dealSize);
      const salesLine = salesAssistedPct != null && salesAssistedPct > 30
        ? ` The fact that ${salesAssistedPct}% of your conversions require sales involvement is a related signal: self-serve upgrade mechanics aren\'t working well enough on their own, so users need a conversation to justify paying.`
        : '';
      const tierLine = tier === 'low'
        ? `At ${usd(dealSize)}/mo, the upgrade decision should be near-instant for an activated user. If it isn\'t, the upgrade moment or the pricing page is creating friction that shouldn\'t exist at that price point.`
        : tier === 'high'
        ? `At ${usd(dealSize)}/mo, users almost certainly need to justify the spend to a stakeholder. The conversion block is likely about ROI articulation and internal sell — not just a better CTA.`
        : `At ${usd(dealSize)}/mo, users are doing a conscious cost-benefit evaluation. The fix is usually clearer ROI framing at the upgrade moment, not a lower price.`;
      return `${activationRate}% of your trial users are reaching core value — that\'s ${activatedUsers.toLocaleString()} users/month who know what your product does. But only ${conversionRate}% are converting to paid.${salesLine} This is a monetisation architecture problem: the revenue engine that should follow product engagement isn\'t firing. ${tierLine}`;
    },

    getRecommendation(inputs) {
      const tier = acvTier(inputs.dealSize);
      if (tier === 'high') {
        return 'Build a clear ROI narrative and upgrade moment for activated users — at your ACV, conversion requires business justification, not just a better CTA.';
      }
      return 'Fix your in-product upgrade mechanics — activated users are not converting because the path from value experience to paid subscription is broken or invisible.';
    },

    getActions(inputs) {
      const { dealSize, activationRate, trials } = inputs;
      const tier = acvTier(dealSize);
      return [
        {
          title: 'Find when activated users first see an upgrade prompt — then move it earlier',
          body: 'Most companies surface upgrade CTAs at trial expiry or on a pricing page, not at the moment of peak engagement. Pull the sequence: when does an activated user first encounter a paid prompt, relative to their activation event? If it\'s more than 48 hours later, you\'re letting the value window close. The upgrade CTA should appear immediately after the activation event, while the value is still being felt.',
        },
        {
          title: tier === 'high'
            ? 'Build a shareable ROI summary for activated users to take to their stakeholders'
            : 'Replace your trial-end sequence with a personalised value recap',
          body: tier === 'high'
            ? `At ${usd(dealSize)}/mo, the person who activates often isn\'t the person who signs off on budget. Build a one-page ROI summary — what the user accomplished in the trial, what the paid product would enable beyond that, and a clear cost-per-outcome figure — that activated users can share internally. Make the internal sell easy.`
            : 'The standard "your trial is expiring" email converts poorly. Replace it with a message showing specifically what the user did in their trial — tasks completed, outputs created, value delivered — paired with a single upgrade CTA. Make the value tangible in their own product terms before asking for money. This change alone typically improves trial-end conversion by 20–40%.',
        },
        {
          title: 'Run a pricing page teardown against three direct competitors',
          body: 'Compare how competitors at your price point present the free-to-paid value gap. Are they leading with outcomes or features? Is the upgrade framed as an investment or a cost? Benchmark on: clarity of the value gap, trust signals (logos, case study snippets), and friction to purchase. Most teams discover one of these three areas is significantly weaker than the market standard — fixing the weakest one is almost always faster than A/B testing copy.',
        },
      ];
    },
  },


  // ── 5. Conversion Bottleneck (undiagnosed) ───────────────────────────────────
  // Triggered when: conversion low, no activation rate provided
  // Surface the cost of not diagnosing before giving direction.

  lowConversion: {
    id: 'lowConversion',
    label: 'Conversion Bottleneck',
    color: 'red',

    getText(inputs) {
      const { conversionRate, trials, dealSize } = inputs;
      const currentMRR = usd(Math.round(trials * conversionRate / 100) * dealSize);
      const mrrAt20 = usd(Math.round(trials * 0.20) * dealSize);
      return `${conversionRate}% conversion means ${(100 - conversionRate).toFixed(0)}% of your trial users don\'t become paying customers. At ${trials.toLocaleString()} monthly trials, the gap between your current ${currentMRR}/mo and what a 20% conversion rate would generate (${mrrAt20}/mo) represents the cost of not resolving this. The two most common root causes require completely different fixes: either users aren\'t reaching value in the trial (activation problem), or they\'re reaching value but not upgrading (monetisation problem). Investing in the wrong one costs you 3–6 months of growth. The most valuable thing you can do this week is determine which one you have.`;
    },

    getRecommendation() {
      return 'Spend one week diagnosing whether this is an activation problem or a monetisation problem before optimising any specific lever — the interventions are completely different.';
    },

    getActions() {
      return [
        {
          title: 'Instrument and measure your activation rate before doing anything else',
          body: 'Define your activation event — the single in-product action that best predicts conversion (ask your sales team or customer success which usage patterns correlate with renewals). Pull the data: what % of trials in the last 60 days reached it within 7 days? Below 35% → activation problem. Above 35% → likely monetisation problem. This single number determines your growth priority for the next quarter.',
        },
        {
          title: 'Interview 5 churned trials and 5 paying customers in the same week',
          body: 'Ask churned trials: "What were you hoping to get from this product, and what stopped you?" Ask paying customers: "What made you decide to pay, and what nearly stopped you?" The contrast between these two groups will surface your funnel leak more precisely than any quantitative analysis. Budget 30 minutes per person — the patterns will emerge clearly within 10 interviews.',
        },
        {
          title: 'Map your trial experience end to end and assess every touchpoint',
          body: 'Document every interaction a trial user has from day 1 to expiry: in-app prompts, emails, upgrade CTAs, empty states. For each one, ask: does this move the user toward value, toward paying, or neither? Many SaaS products have a trial experience with no coherent narrative — just disconnected nudges that were added reactively. Fix the architecture before optimising individual touchpoints.',
        },
      ];
    },
  },


  // ── 6. Sales-Dependent Funnel ────────────────────────────────────────────────
  // Triggered when: sales-assist % very high (>55%) AND conversion ≥ 10%
  // Signal: the PLG motion is functioning as a lead source for sales, not as
  // a self-sufficient revenue engine. Growth is headcount-constrained.

  salesDriven: {
    id: 'salesDriven',
    label: 'Sales-Dependent Funnel',
    color: 'amber',

    getText(inputs) {
      const { conversionRate, salesAssistedPct, dealSize, trials } = inputs;
      const tier = acvTier(dealSize);
      const selfServeRate = +(conversionRate * (1 - salesAssistedPct / 100)).toFixed(1);
      const selfServePaid = Math.round(trials * selfServeRate / 100);
      const tierLine = tier === 'low'
        ? `At ${usd(dealSize)}/mo average deal, a sales touch likely costs more than it generates in first-year gross margin on many deals — this is a unit economics problem, not just a scale problem.`
        : tier === 'high'
        ? `At ${usd(dealSize)}/mo, sales involvement is commercially justifiable on individual deals — but if the product can\'t drive self-serve conversion at scale, growth will always be headcount-constrained.`
        : `At ${usd(dealSize)}/mo, you have ACV headroom to make individual sales touches work, but it will cap growth velocity as you try to scale.`;
      return `${salesAssistedPct}% of your conversions require sales involvement. Strip that out, and your underlying self-serve conversion rate is approximately ${selfServeRate}% — generating roughly ${selfServePaid.toLocaleString()} self-serve customers per month. Your PLG motion is currently functioning as a top-of-funnel lead source for your sales team rather than as a self-sufficient revenue engine. ${tierLine} The compounding risk: the features and flows that would drive self-serve conversion aren\'t being built, because sales is compensating for their absence. The product debt accumulates silently while the sales team grows.`;
    },

    getRecommendation(inputs) {
      const tier = acvTier(inputs.dealSize);
      if (tier === 'low') {
        return 'Rebuild self-serve conversion mechanics urgently — at your ACV, sales-assisted conversion is not economically sustainable and is masking a product gap.';
      }
      if (tier === 'high') {
        return 'Build a parallel self-serve conversion path alongside your sales motion — your enterprise deals may justify sales, but you need a product-led path to unlock non-linear growth.';
      }
      return 'Identify the top 3 reasons sales is being called in and build product fixes for each — every reduction in sales-assist % is a direct improvement to growth efficiency.';
    },

    getActions(inputs) {
      const { salesAssistedPct, dealSize, conversionRate } = inputs;
      const tier = acvTier(dealSize);
      const targetPct = Math.max(15, salesAssistedPct - 20);
      return [
        {
          title: 'Audit why sales is being called in — categorise the top 3 reasons',
          body: 'Pull your last 20 sales-assisted deals and ask your reps: "What question or objection would have prevented your involvement if the product had already answered it?" Most sales involvement falls into 3–4 recurring categories: pricing clarity, security or compliance questions, integration concerns, or internal sign-off support. Each category is a product or content gap — not an irreducible need for human contact.',
        },
        {
          title: 'Build a complete self-serve upgrade flow for your most common deal tier',
          body: `Most companies build a sales motion first and never build a parallel self-serve path. Create a fully self-serve upgrade flow for deals around ${usd(dealSize)}/mo: clean pricing page, frictionless card entry, instant provisioning, and clear feature comparison. Run it for 60 days alongside your current sales process and measure what % of the next cohort completes it without a touch. That number is your baseline self-serve conversion rate.`,
        },
        {
          title: tier === 'low'
            ? `Set a 90-day target to reduce sales-assist from ${salesAssistedPct}% to ${targetPct}% and track it as a product metric`
            : 'Define which deal segments should be self-serve vs. sales-assisted and build different flows for each',
          body: tier === 'low'
            ? `At ${usd(dealSize)}/mo, every sales-assisted conversion is compressing margin. Treat sales-assist % as a product health metric — it tracks in the same view as activation and conversion. Set a quarterly target (e.g. ${salesAssistedPct}% → ${targetPct}%) and assign the reduction to product, not sales ops.`
            : `At your ACV, not every deal should be self-serve — and that\'s fine. The goal is clarity about which segments go which route. Define your segmentation: e.g. deals under ${usd(dealSize / 2)}/mo are self-serve; above that, a sales touch is offered. Build different onboarding and upgrade flows for each segment, and stop treating every conversion identically.`,
        },
      ];
    },
  },


  // ── 7. Funnel Underperformance ───────────────────────────────────────────────
  // Triggered when: conversion 10–20%
  // Signal: the PLG motion works, but is leaving meaningful revenue on the table.
  // The best returns come from identifying the 2–3 friction points costing the
  // most conversions and removing them systematically.

  efficiencyGap: {
    id: 'efficiencyGap',
    label: 'Funnel Underperformance',
    color: 'amber',

    getText(inputs) {
      const { conversionRate, trials, dealSize, activationRate, salesAssistedPct } = inputs;
      const gapCustomers = Math.round(trials * (20 - conversionRate) / 100);
      const gapMRR = usd(gapCustomers * dealSize);
      const severity = conversionRate < 14 ? 'clearly underperforming' : conversionRate < 17 ? 'in the average range' : 'close to strong';
      const activationLine = activationRate != null
        ? activationRate < 40
          ? ` Your activation rate of ${activationRate}% is the most likely drag — users who don\'t activate rarely convert, and activation improvement typically delivers the fastest gains in this conversion range.`
          : ` Your activation rate of ${activationRate}% is healthy, which suggests the conversion gap is primarily a monetisation mechanics issue rather than a product-value problem.`
        : '';
      const salesMaskLine = salesAssistedPct != null && salesAssistedPct > 35
        ? ` More importantly: with ${salesAssistedPct}% sales assist, your underlying self-serve conversion rate is approximately ${(conversionRate * (1 - salesAssistedPct / 100)).toFixed(1)}% — that\'s the number that actually tells you how your PLG motion is performing, and it\'s likely materially lower than the headline ${conversionRate}%.`
        : '';
      return `${conversionRate}% conversion is ${severity} — the gap to 20% represents ${gapCustomers} additional customers and ${gapMRR}/mo in reachable MRR without changing a single acquisition input.${activationLine}${salesMaskLine} At this range the answer is rarely one big fix — it\'s finding the two or three highest-cost friction points and removing them in sequence.`;
    },

    getRecommendation(inputs) {
      const { activationRate } = inputs;
      if (activationRate != null && activationRate < 40) {
        return `Lift activation first — at ${activationRate}% you\'re losing potential conversions before users even reach the monetisation decision.`;
      }
      return 'Run structured conversion experiments — one hypothesis per trial cycle, starting with the trial-end experience, which is almost always the highest-leverage point.';
    },

    getActions(inputs) {
      const { dealSize, activationRate, conversionRate, trials } = inputs;
      const tier = acvTier(dealSize);
      const actions = [];

      if (activationRate != null && activationRate < 40) {
        actions.push({
          title: 'Close the activation gap before running conversion rate experiments',
          body: `${Math.round(trials * (1 - activationRate / 100)).toLocaleString()} trial users per month never experience what you\'re trying to sell. Run a cohort analysis: what did users who converted do in their first 72 hours that churned users didn\'t? That behavioural difference is your activation intervention — fix it before optimising anything downstream.`,
        });
      }

      actions.push({
        title: 'Build and run a conversion experiment backlog — one test per trial cycle',
        body: 'Create a prioritised list of specific conversion hypotheses (e.g. "showing a personalised value summary before the upgrade CTA will increase conversion by 15%"). Run one per full trial cycle — long enough to measure real conversion signal, not click-through. After 3 cycles you\'ll have a repeatable optimisation process and a data-backed view of your biggest levers.',
      });

      actions.push({
        title: 'Segment conversion rate by acquisition channel and ICP fit — not just overall',
        body: `Your ${conversionRate}% likely masks significant variation. Some channels may convert at 25%+ while others drag the average down. Pull trial-to-paid conversion by source and, if possible, by company size or ICP fit. Reallocating acquisition budget toward your highest-converting segments will lift the overall rate without a single product change — and tells you which experiments to run first.`,
      });

      if (actions.length < 3) {
        actions.push({
          title: 'Redesign your trial-end experience around personalised value evidence',
          body: 'The final 48 hours of a trial are the highest-leverage conversion window most products underuse. Build a trial-end flow that shows the user exactly what they accomplished — not what they could do — then pairs it with a single upgrade CTA. Personalisation using actual usage data consistently outperforms generic expiry sequences by 2–4× in B2B SaaS.',
        });
      }

      return actions.slice(0, 3);
    },
  },


  // ── 8. Acquisition Constraint ────────────────────────────────────────────────
  // Triggered when: conversion ≥ 20%, trials < 300
  // Signal: the conversion engine is proven. The constraint is volume.

  volumeConstrained: {
    id: 'volumeConstrained',
    label: 'Acquisition Constraint',
    color: 'indigo',

    getText(inputs) {
      const { conversionRate, trials, dealSize, salesAssistedPct, activationRate } = inputs;
      const addedAtTarget = Math.round((500 - trials) * (conversionRate / 100));
      const addedMRR = usd(addedAtTarget * dealSize);
      const salesLine = salesAssistedPct != null && salesAssistedPct > 40
        ? ` Note: with ${salesAssistedPct}% sales assist, it\'s worth confirming how much of that ${conversionRate}% is genuinely product-led before building pure self-serve acquisition — the right acquisition strategy looks different depending on which motion is actually converting.`
        : '';
      const activationAnomalyLine = activationRate != null && activationRate < T.activationWeak
        ? ` One flag worth investigating: your activation rate of ${activationRate}% is unusually low for a ${conversionRate}% conversion rate. This typically means either your activation event is defined incorrectly (it\'s not measuring actual value attainment), or sales is compensating for a self-serve experience that wouldn\'t convert at this rate on its own. Verify the relationship holds before scaling acquisition spend.`
        : '';
      return `${conversionRate}% conversion is strong — your product-market fit and monetisation are working. The constraint is volume: at ${trials.toLocaleString()} monthly trials, you\'re running a high-efficiency but low-throughput engine. Scaling from ${trials.toLocaleString()} to 500 trials/month at your current rate would add approximately ${addedMRR}/mo without changing anything downstream.${salesLine}${activationAnomalyLine} The growth question has shifted from "does our funnel work?" to "how do we fill it with the right buyers, faster, without breaking conversion in the process?"`;
    },

    getRecommendation(inputs) {
      const { salesAssistedPct } = inputs;
      if (salesAssistedPct != null && salesAssistedPct > 40) {
        return 'Scale acquisition — but build self-serve channels in parallel with sales-assisted ones or you\'ll hit a headcount ceiling before a revenue one.';
      }
      return 'Invest aggressively in top-of-funnel — your unit economics justify scaling spend, and your conversion engine can absorb significantly more volume than it\'s currently seeing.';
    },

    getActions(inputs) {
      const { conversionRate, trials, dealSize, salesAssistedPct } = inputs;
      const tier = acvTier(dealSize);
      return [
        {
          title: 'Find your highest-converting acquisition channel and build a scalable playbook for it first',
          body: `Pull the last 3 months of paid conversions segmented by acquisition source. Find the channel with the highest trial-to-paid conversion rate — not just trial volume. At ${conversionRate}% overall, your best channel is likely converting at 25–35%. Build a repeatable playbook for that channel — target ICP, messaging, format, conversion asset — before diversifying into new channels. Premature channel diversification is one of the most common ways companies with strong conversion rates fail to scale.`,
        },
        {
          title: 'Build a product-led referral loop into your activation flow',
          body: 'With strong conversion, your paying customers are your cheapest acquisition channel and the one most companies underuse. Find the moment in your product where users derive the most value — the point where they\'d naturally want to share or involve others. Add a referral or invite mechanism there as part of the product experience. In-product referral triggered at the value moment generates trials that convert at 2–3× the rate of paid channels, at near-zero CAC.',
        },
        {
          title: tier === 'high'
            ? 'Build a warm outbound motion using product-usage signals from non-converting trials'
            : 'Test a free tier or freemium model to remove the trial barrier for hesitant buyers',
          body: tier === 'high'
            ? `At ${usd(dealSize)}/mo, your deal size justifies targeted outbound. Use product-usage data — e.g. users who activated but didn\'t convert, or churned after day 7 — as your outbound list. This is warm outbound with a genuine hook ("I noticed you tried X during your trial") and converts at significantly higher rates than cold sequences with similar targeting.`
            : `If your conversion engine is strong, the fastest way to grow trial volume is to lower the barrier to starting. A free tier or freemium model removes the time commitment of a trial entirely. Run a 90-day test: measure trial starts, activation rate, and conversion of free users. If your product delivers value quickly, freemium typically multiplies top-of-funnel volume without meaningfully diluting conversion among users who activate.`,
        },
      ];
    },
  },


  // ── 9. Scale Mode ────────────────────────────────────────────────────────────
  // Triggered when: conversion ≥ 20%, trials ≥ 300
  // Signal: the PLG motion is working. Growth levers shift toward retention,
  // expansion, and protecting conversion as ICP broadens.

  scaleMode: {
    id: 'scaleMode',
    label: 'Scale Mode',
    color: 'green',

    getText(inputs, metrics) {
      const { conversionRate, trials, dealSize, activationRate, salesAssistedPct } = inputs;
      const annualMRR = usd(metrics.mrr * 12);
      const salesLine = salesAssistedPct != null && salesAssistedPct > 40
        ? ` One structural caveat: ${salesAssistedPct}% sales assist means a portion of your conversion efficiency is sales-driven. At scale, this becomes a capacity constraint — and the self-serve conversion infrastructure that should exist likely hasn\'t been prioritised because sales has been compensating.`
        : '';
      const activationLine = activationRate != null && activationRate < 45
        ? ` Your activation rate of ${activationRate}% is the main remaining efficiency gap — lifting it is your highest-ROI conversion lever and doesn\'t require more acquisition spend.`
        : '';
      return `${conversionRate}% conversion across ${trials.toLocaleString()} monthly trials is a strong PLG foundation — implying ~${annualMRR} in annualised new-customer MRR.${activationLine}${salesLine} At this level, the growth priorities change. The three biggest risks are: conversion dilution as you scale into broader audiences, expansion revenue being under-invested relative to new ARR, and CAC rising as you exhaust efficient acquisition channels. The work shifts from "making the funnel work" to "protecting it as you scale and compounding through customer success."`;
    },

    getRecommendation(inputs) {
      const { activationRate, salesAssistedPct } = inputs;
      if (salesAssistedPct != null && salesAssistedPct > 40) {
        return 'Protect your conversion rate as you scale by building self-serve conversion infrastructure now — before sales capacity becomes your growth ceiling.';
      }
      if (activationRate != null && activationRate < 45) {
        return 'Close the activation gap to capture the remaining conversion upside, then shift investment toward retention and expansion, which will outperform new ARR acquisition at your scale.';
      }
      return 'Shift investment toward retention and expansion revenue — at your conversion efficiency, NRR and LTV optimisation will generate more growth per dollar than further acquisition investment.';
    },

    getActions(inputs, metrics) {
      const { conversionRate, trials, dealSize, activationRate, salesAssistedPct } = inputs;
      const tier = acvTier(dealSize);
      const convFloor = Math.max(18, conversionRate - 2);
      return [
        {
          title: 'Set a conversion rate floor and instrument cohort-level conversion tracking',
          body: `Conversion dilution is the silent growth killer at scale — you broaden ICP, add acquisition channels, run more experiments, and ${conversionRate}% quietly becomes 15% over 18 months. Set a conversion floor (e.g. ${convFloor}%) that triggers a structured review if breached. Track conversion weekly by cohort, channel, and ICP segment, not just as a blended average. Catching dilution early costs 10× less to fix than discovering it after two quarters of scaled acquisition.`,
        },
        {
          title: 'Build a systematic expansion revenue motion for your top 20% of customers',
          body: 'At your stage, expansion MRR typically represents 30–40% of net new ARR in high-growth SaaS — and most companies at your conversion rate under-invest in it because new acquisition still feels more exciting. Identify your top 20% of customers by usage depth and product engagement, and build a deliberate expansion playbook: trigger-based upsell prompts at usage thresholds, structured success reviews at 90 days, and an expansion-qualified lead (EQL) definition for your CS team.',
        },
        {
          title: activationRate != null && activationRate < 45
            ? 'Run an activation improvement sprint before your next significant acquisition push'
            : 'Invest in acquisition channel diversification before your primary channel shows saturation',
          body: activationRate != null && activationRate < 45
            ? `You have strong conversion among activated users, but ${(100 - activationRate).toFixed(0)}% of trials never activate. A focused 6-week activation sprint — entirely aimed at time-to-value and onboarding friction — run concurrently with current acquisition spend will likely add more MRR than an equivalent increase in paid acquisition budget. Run it before scaling spend further.`
            : `Channel concentration is a compounding risk at scale. If more than 50% of your trials come from one source, build a second before the primary one shows saturation. The time to invest in a new channel is when your primary is still performing well — not after CPAs start rising. Identify your second-best converting source and run a structured 90-day scaling experiment to establish its cost curve and ICP fit.`,
        },
      ];
    },
  },

};


// ── Confidence scoring ─────────────────────────────────────────────────────────
// Confidence reflects how much the available data supports the diagnosis.
// High = multiple signals align and confirm. Medium = pattern fits but data is
// incomplete or ambiguous. Low = diagnosis is an educated guess; more data needed.

function computeConfidence(inputs, diagnosisId) {
  const { conversionRate, activationRate, salesAssistedPct } = inputs;
  const hasActivation = activationRate != null;
  const hasSales      = salesAssistedPct != null;

  switch (diagnosisId) {

    case 'productValueGap':
      if (!hasActivation)
        return { level: 'medium', reason: 'Inferred from low conversion alone — add activation rate to distinguish a product-value gap from a severe activation bottleneck.' };
      if (activationRate < 20 && conversionRate < 7)
        return { level: 'high', reason: 'Both conversion and activation are critically low — the signals mutually confirm this diagnosis.' };
      return { level: 'medium', reason: 'Very low conversion with weak activation is consistent with a product-value gap, but activation isn\'t severe enough to rule out that onboarding is the primary constraint.' };

    case 'activationLeak':
      if (conversionRate < 7 && activationRate < 30)
        return { level: 'high', reason: 'Low activation directly explains low conversion — the constraint is clearly upstream of the monetisation decision.' };
      return { level: 'medium', reason: 'Activation is weak but not catastrophically low — monetisation friction may also be contributing to the conversion shortfall.' };

    case 'freeTooGood':
      if (activationRate >= 65 && conversionRate < 7)
        return { level: 'high', reason: `${activationRate}% activation with ${conversionRate}% conversion is a clean value-capture signal — users are getting what they need for free.` };
      return { level: 'medium', reason: 'High activation with low conversion strongly suggests a value-capture problem, but other monetisation mechanics may also be contributing.' };

    case 'monetisationBlock':
      if (hasSales && salesAssistedPct > 35)
        return { level: 'medium', reason: `${salesAssistedPct}% sales assist means your self-serve monetisation problem is likely worse than the headline conversion rate suggests — the true gap may be obscured.` };
      if (!hasSales)
        return { level: 'medium', reason: 'Activation and conversion data point at monetisation, but without sales-assist data it\'s impossible to rule out that some conversions are being carried by sales.' };
      if (activationRate >= 40 && conversionRate < 8 && salesAssistedPct < 25)
        return { level: 'high', reason: 'Good activation, low self-serve conversion, minimal sales involvement — the monetisation gap is well-evidenced and unambiguous.' };
      return { level: 'medium', reason: 'The activation-conversion pattern fits a monetisation gap, but the data isn\'t clean enough to be fully certain.' };

    case 'lowConversion':
      return { level: 'low', reason: 'Without activation rate data, root cause cannot be determined. An activation problem and a monetisation problem look identical at the surface — and the fixes are completely different.' };

    case 'salesDriven':
      if (salesAssistedPct > 65)
        return { level: 'high', reason: `${salesAssistedPct}% sales involvement is unambiguously a sales-led motion — the PLG framing does not reflect how revenue is actually being generated.` };
      return { level: 'medium', reason: `${salesAssistedPct}% sales assist is high but doesn\'t fully rule out a meaningful self-serve component running alongside it.` };

    case 'efficiencyGap': {
      if (hasActivation && hasSales)
        return { level: 'high', reason: 'Full signal set — activation and sales-assist data are both available, allowing a targeted diagnosis of where the efficiency loss is concentrated.' };
      if (!hasActivation && !hasSales)
        return { level: 'low', reason: 'Without activation or sales-assist data, the specific friction point can\'t be identified — the action plan will be exploratory rather than targeted.' };
      return { level: 'medium', reason: 'Partial data — adding the missing optional metric would allow a more targeted action plan and a higher chance of identifying the right lever first.' };
    }

    case 'volumeConstrained':
      if (hasSales && salesAssistedPct > 40)
        return { level: 'medium', reason: `${salesAssistedPct}% sales assist means the ${conversionRate}% rate is partly sales-driven — verify your self-serve conversion rate before scaling acquisition spend.` };
      if (hasActivation && activationRate < T.activationWeak)
        return { level: 'medium', reason: `Strong conversion with weak activation (${activationRate}%) is unusual — it may mean sales is compensating for a product experience that won\'t scale self-serve.` };
      return { level: 'high', reason: 'Strong conversion at low trial volume is a clean acquisition constraint — the unit economics clearly justify scaling spend.' };

    case 'scaleMode':
      if (hasSales && salesAssistedPct > 40)
        return { level: 'medium', reason: `${salesAssistedPct}% sales assist means growth velocity is partly headcount-constrained — self-serve investment is important before aggressive scaling.` };
      if (hasActivation && activationRate < T.activationWeak)
        return { level: 'medium', reason: `Strong conversion with weak activation (${activationRate}%) is worth investigating — sales may be compensating for a product weakness that will surface as you scale into self-serve segments.` };
      return { level: 'high', reason: 'Strong conversion at scale with no significant anomalies — the scale mode framing is well-supported by the data.' };

    default:
      return { level: 'medium', reason: 'Standard confidence based on available data.' };
  }
}


// ── Sales flag (supplementary context, shown alongside primary diagnosis) ──────

const SALES_FLAG = {
  label: 'Sales-Assist Risk',
  getText(pct, dealSize) {
    const tier = acvTier(dealSize);
    if (tier === 'low') {
      return `${pct}% sales-assisted conversions at ${usd(dealSize)}/mo is a unit economics problem. The fully-loaded cost of a sales touch — time, tooling, management overhead — likely exceeds the first-year gross margin on many of these deals. Self-serve upgrade mechanics aren\'t optional at this price point; they\'re a margin requirement.`;
    }
    if (tier === 'high') {
      return `${pct}% sales-assisted conversions is commercially reasonable at ${usd(dealSize)}/mo ACV, but it means growth velocity is partly headcount-dependent. Build a self-serve path for faster-moving buyers and smaller deals to avoid leaving PLG upside on the table as you scale into new segments.`;
    }
    return `${pct}% sales-assisted conversions caps growth velocity at ${usd(dealSize)}/mo — revenue scales with headcount rather than product adoption. Identify the top 2–3 reasons sales gets involved and build product or content solutions for each. Track sales-assist % as a product metric alongside conversion and activation.`;
  },
};


// ── Core functions ─────────────────────────────────────────────────────────────

/**
 * Compute funnel metrics from raw inputs.
 */
function computeMetrics({ trials, conversionRate, dealSize }) {
  const paidUsers = Math.round(trials * (conversionRate / 100));
  const mrr = paidUsers * dealSize;
  const conversionBand =
    conversionRate < T.conversionLow    ? 'low'     :
    conversionRate < T.conversionStrong ? 'average' : 'strong';
  return { paidUsers, mrr, conversionBand };
}

/**
 * Determine primary diagnosis and whether the supplementary sales flag applies.
 * Evaluates multiple signals simultaneously rather than a simple if/else tree.
 */
function diagnose(inputs) {
  const { conversionRate, activationRate, trials, salesAssistedPct } = inputs;
  const isSalesDriven = salesAssistedPct != null && salesAssistedPct > T.salesDriven;
  let primary;

  // Sales-driven funnel takes priority when conversion is functional (≥10%)
  // but most of it is being carried by sales — this is the headline story.
  // Exception: if conversion is below 10% even with heavy sales involvement,
  // the product problem is more fundamental than the sales dependency.
  if (isSalesDriven && conversionRate >= T.conversionLow) {
    primary = DIAGNOSIS.salesDriven;

  } else if (conversionRate < T.conversionLow) {
    if (activationRate != null) {
      if (activationRate < T.activationSevere) {
        // Very low activation — product isn't delivering value in the trial window
        primary = DIAGNOSIS.productValueGap;
      } else if (activationRate < T.activationWeak) {
        // Activation exists but is unreliable — onboarding/path-to-value problem
        primary = DIAGNOSIS.activationLeak;
      } else if (activationRate >= T.activationGood) {
        // High activation + low conversion = value capture / pricing problem
        primary = DIAGNOSIS.freeTooGood;
      } else {
        // Activation functional (35–55%) + low conversion = monetisation architecture
        primary = DIAGNOSIS.monetisationBlock;
      }
    } else if (conversionRate < T.conversionCritical) {
      // Very low conversion, no activation data — most likely a product-value problem
      primary = DIAGNOSIS.productValueGap;
    } else {
      // Low conversion, no activation data — can't diagnose precisely
      primary = DIAGNOSIS.lowConversion;
    }

  } else if (conversionRate >= T.conversionStrong) {
    primary = trials < T.trialsLow ? DIAGNOSIS.volumeConstrained : DIAGNOSIS.scaleMode;

  } else {
    // 10–20%: functional but underperforming
    primary = DIAGNOSIS.efficiencyGap;
  }

  // Show the sales flag as supplementary context for notable but not dominant sales assist
  const hasSalesFlag = !isSalesDriven && salesAssistedPct != null && salesAssistedPct > T.salesLeaning;
  const confidence = computeConfidence(inputs, primary.id);
  return { primary, hasSalesFlag, confidence };
}

/**
 * Estimate additional MRR from +5% and +10% conversion improvements.
 */
function computeMissedRevenue({ trials, conversionRate, dealSize }) {
  const current = trials * (conversionRate / 100);
  const scenario = (delta) => {
    const newRate = Math.min(100, conversionRate + delta);
    const customers = Math.round(trials * (newRate / 100) - current);
    return { mrr: Math.round(customers * dealSize), customers };
  };
  return { plus5: scenario(5), plus10: scenario(10) };
}

/**
 * Build a plain-text summary for clipboard sharing.
 */
function buildSummary(inputs, metrics, { primary, hasSalesFlag, confidence }) {
  const missed = computeMissedRevenue(inputs);
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const diagText   = primary.getText(inputs, metrics);
  const rec        = primary.getRecommendation(inputs, metrics);
  const actions    = primary.getActions(inputs, metrics);

  const lines = [
    'PLG GROWTH DECISION TOOL — SUMMARY',
    `Generated ${date}`,
    '',
    '── FUNNEL SNAPSHOT',
    `Monthly Trials         ${inputs.trials.toLocaleString()}`,
    `Conversion Rate        ${inputs.conversionRate}% (${metrics.conversionBand})`,
    `Paid Customers/mo      ${metrics.paidUsers.toLocaleString()}`,
    `Estimated MRR          $${metrics.mrr.toLocaleString()}`,
    inputs.activationRate   != null ? `Activation Rate        ${inputs.activationRate}%`   : null,
    inputs.salesAssistedPct != null ? `Sales-Assisted         ${inputs.salesAssistedPct}%` : null,
    '',
    '── DIAGNOSIS',
    `${primary.label}${confidence ? ` — ${confidence.level.charAt(0).toUpperCase() + confidence.level.slice(1)} Confidence` : ''}`,
    confidence ? `(${confidence.reason})` : null,
    diagText,
    hasSalesFlag ? `\nAdditional — ${SALES_FLAG.label}\n${SALES_FLAG.getText(inputs.salesAssistedPct, inputs.dealSize)}` : null,
    '',
    '── PRIMARY RECOMMENDATION',
    rec,
    '',
    '── ACTION PLAN',
    ...actions.map((a, i) => `${i + 1}. ${a.title}\n   ${a.body}`),
    '',
    '── MISSED REVENUE OPPORTUNITY',
    `+5% conversion  → +$${missed.plus5.mrr.toLocaleString()}/mo  (+${missed.plus5.customers} customers/mo)`,
    `+10% conversion → +$${missed.plus10.mrr.toLocaleString()}/mo  (+${missed.plus10.customers} customers/mo)`,
  ];

  return lines.filter(Boolean).join('\n');
}
