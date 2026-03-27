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
        ? `${activationRate}% activation means ${Math.round(trials * activationRate / 100).toLocaleString()} users/month are reaching what you've defined as your core value moment — and still not paying. Either the activation event is wrong (not a genuine value signal), or the product delivers something users don't feel is worth paying for.`
        : `${(100 - conversionRate).toFixed(0)}% of ${trials.toLocaleString()} trials are not converting, and without activation data you can't isolate where they're exiting. Add activation rate — it's the single number that determines your fix.`;
      const whyLine = tier === 'low'
        ? `At ${usd(dealSize)}/mo, there is no ACV headroom to compensate with sales. The product needs to create and close its own demand at volume — and right now it isn't.`
        : tier === 'high'
        ? `At ${usd(dealSize)}/mo, users need a commercially legible ROI outcome they can take to a stakeholder. The trial is showing them features. It needs to show them business results.`
        : `At ${usd(dealSize)}/mo, price sensitivity is not the problem. Users who experience genuine value at this price point pay. The felt value isn't landing.`;
      const salesIronyLine = salesAssistedPct != null && salesAssistedPct > 40
        ? ` The sharpest signal in your data: ${salesAssistedPct}% of conversions require direct sales involvement, and the overall rate is still only ${conversionRate}%. Sales is personally working these deals and failing to close most of them. That eliminates funnel, pricing, and onboarding fixes as primary levers — the product isn't delivering enough value for any motion to work.`
        : '';
      return `${conversionRate}% conversion is not a funnel problem. It is a signal that most users are not experiencing enough value in the trial to justify paying. Every downstream fix — emails, CRO tests, pricing adjustments — treats symptoms of a root cause they cannot resolve. You are not losing users at the upgrade decision. You are losing them before they care about upgrading. ${activationLine} ${whyLine}${salesIronyLine}`;
    },

    getRecommendation(inputs) {
      const { conversionRate } = inputs;
      return `Focus entirely on the product-market fit gap within the trial window. Nothing else moves the needle at ${conversionRate}% conversion. Do not invest in acquisition, CRO, or pricing changes yet — every trial you add is wasted spend until users can reliably experience the value. Run JTBD research with paying customers this week. All other work is downstream of what you learn there.`;
    },

    getActions(inputs) {
      return [
        {
          title: 'Step 1 — Run a Jobs-to-be-Done study with your last 10 paying customers',
          body: 'Ask each paying customer: "What were you trying to accomplish when you signed up, and what specifically made you decide to pay?" Then compare their answers to what your current onboarding flow actually does. The gap between those two things is your diagnosis. This exercise surfaces the positioning and product changes that no analytics dashboard will show you — and scopes every fix that follows it.',
        },
        {
          title: 'Step 2 — Watch session recordings of trials who were active past day 10 but didn\'t convert',
          body: 'Use Hotjar, FullStory, or LogRocket to watch 10–15 sessions of users who stayed engaged late in the trial but churned without paying. These users were motivated enough to keep coming back — something specific stopped them. Use the JTBD findings from Step 1 to know what to look for. You\'re looking for repeated friction on the same screen, or moments where users clearly wanted to do something the product didn\'t let them do easily.',
        },
        {
          title: 'Step 3 — Redefine your activation event against actual conversion data',
          body: 'Plot which in-product actions correlate with paid conversion in your existing customer base. If your current activation event doesn\'t predict conversion, you\'ve defined it wrong — you\'re measuring a behaviour, not a value moment. Redefine it as the single action that best separates paying customers from churners, then measure what % of current trials actually reach it within 7 days. That number becomes your primary growth metric.',
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
      const nonActivating = (trials - activatedUsers).toLocaleString();
      return `${activationRate}% activation means ${nonActivating} of your ${trials.toLocaleString()} monthly trials exit before experiencing what they'd be paying for. Your ${conversionRate}% overall conversion rate is a downstream number — the real problem is upstream. So what: at a conservative 30% conversion among activated users, closing this gap adds ~${potentialMRR}/mo without touching acquisition, pricing, or your product's core value. Why: at ${activationRate}%, the bottleneck is distance to value. Users hit setup steps, configuration requirements, or friction before they reach the value moment — and disengage before getting there. The problem is almost never the value itself. It's the path between signup and experiencing it.`;
    },

    getRecommendation(inputs) {
      const { trials, activationRate } = inputs;
      const nonActivating = Math.round(trials * (1 - activationRate / 100));
      return `Focus all product effort on activation improvement — this is your highest-leverage fix and it compounds directly into conversion. Do not increase acquisition spend or run paid campaigns at ${activationRate}% activation. You are adding ${nonActivating.toLocaleString()} wasted trials per month to a funnel with a known upstream leak. Close the leak first, then scale volume.`;
    },

    getActions(inputs) {
      const { activationRate, trials } = inputs;
      const nonActivating = Math.round(trials * (1 - activationRate / 100));
      return [
        {
          title: 'Step 1 — Instrument time-to-activate, not just activation rate',
          body: `Knowing that ${activationRate}% activate isn\'t enough — you need to know when. If median time-to-activate is more than 3 days, users are churning before they reach value. Pull the time from signup to activation event for your last 90 days of trials. Most high-converting PLG products reach the value moment within one session. If yours doesn\'t, speed to value is a bigger lever than anything else you could test.`,
        },
        {
          title: 'Step 2 — Find the single highest-exit step and fix it before touching anything else',
          body: `Pull your step-by-step funnel analytics from signup to activation event. Find the one step with the highest exit rate — don\'t try to fix the whole flow at once. Roughly ${nonActivating.toLocaleString()} users/month are not activating; moving even 20% of them past the worst step is a material gain. The culprit is usually a setup requirement, a permissions request, or a configuration step that feels mandatory but can be deferred or eliminated.`,
        },
        {
          title: 'Step 3 — Build a zero-configuration path to your core value moment',
          body: 'Most users won\'t invest in full product setup until they\'ve seen genuine value — but your onboarding likely asks them to set up before they see anything worth setting up for. Build a lightweight demo mode, a pre-populated template, or a guided first-run experience that delivers the core value moment with zero configuration. Users who see value in session one complete setup later. Users who hit setup first churn before they ever see what the product does.',
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
      const notPaying = Math.round(trials * activationRate / 100 * (1 - conversionRate / 100));
      const tierLine = tier === 'low'
        ? `At ${usd(dealSize)}/mo, the upgrade decision should be near-instant for a user who's experienced the value. If ${(100 - conversionRate).toFixed(0)}% aren't converting, the free tier has no ceiling that makes paid feel necessary.`
        : `At ${usd(dealSize)}/mo, an activated user should be evaluating the upgrade seriously. ${(100 - conversionRate).toFixed(0)}% are not — which means the free product is delivering the primary outcome without a compelling reason to go further.`;
      return `${activationRate}% activation and ${conversionRate}% conversion is an expensive combination. Roughly ${notPaying.toLocaleString()} users/month experience genuine product value and choose not to pay for it. So what: this is not an onboarding problem, a marketing problem, or a pricing problem. The free product is doing the job that paid should do. ${tierLine} Why: the free/paid boundary is in the wrong place — you are not gating features with genuine commercial value, or the ceiling that creates upgrade pressure does not exist. Non-obvious: your ${notPaying.toLocaleString()} activated non-converters are your most valuable research cohort. They have validated the product. Ask them what they'd pay for — their answers locate your boundary problem faster than any A/B test.`;
    },

    getRecommendation(inputs) {
      const { conversionRate, activationRate, dealSize } = inputs;
      const tier = acvTier(dealSize);
      if (tier === 'low') {
        return `Redesign the free/paid boundary — your free tier removes the primary reason to upgrade. Do not lower your price. Users are not hesitating because ${usd(dealSize)}/mo is too expensive; they are not upgrading because they do not need to. A discount makes a boundary problem worse. Interview ${Math.min(10, 5)} activated non-converters this week to find where the boundary should move.`;
      }
      return `Audit what you are giving away for free and move the boundary. The ${activationRate}% vs ${conversionRate}% gap is a direct readout of your free tier removing the primary reason to pay. Do not add more paid features before fixing this — more paid features will not move conversion if activated users are already satisfied without paying.`;
    },

    getActions(inputs) {
      const { dealSize, activationRate } = inputs;
      return [
        {
          title: 'Step 1 — Map which activated behaviours predict paid conversion, then gate the right ones',
          body: 'Pull your cohort data: which specific in-product actions do paying customers take in their trial that non-converting activated users don\'t? Those actions are your genuine value moments. If they\'re currently available on the free tier with no friction or limit, you\'ve found your boundary problem. The product strategy question is which features generate upgrade pressure vs. which build the habit that makes upgrading feel worthwhile — those are different features and shouldn\'t be gated the same way.',
        },
        {
          title: 'Step 2 — Run willingness-to-pay research with 10 highly activated trial users',
          body: 'Ask: "If you had to pay for this product starting today, what would you pay for and what would you cut?" Their answers will show you which features carry genuine commercial value and which are nice-to-have. Price to the former; give away the latter. Most teams discover their free tier includes their most commercially valuable features, and their paid tier gates things users don\'t actually value. This directly informs where to move the boundary.',
        },
        {
          title: 'Step 3 — Move your upgrade trigger to the moment of maximum value, not trial expiry',
          body: `The best upgrade moment is immediately after a user experiences peak value and wants more — not when the trial clock runs out. Map the exact in-product moment where activated users derive the most benefit, then introduce a natural ceiling or upgrade prompt there. At ${usd(dealSize)}/mo this should feel like a logical next step, not a paywall. The timing matters as much as the gate itself.`,
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
      const notConverting = activatedUsers - Math.round(trials * conversionRate / 100);
      const salesLine = salesAssistedPct != null && salesAssistedPct > 30
        ? ` ${salesAssistedPct}% of conversions require sales involvement — which means self-serve upgrade mechanics are not working on their own.`
        : '';
      const whyLine = tier === 'low'
        ? `At ${usd(dealSize)}/mo, the upgrade decision should be near-instant for an activated user. The most common failure: the upgrade CTA appears at trial expiry rather than at peak engagement, or the path from activation to checkout has unnecessary friction. Non-obvious: most products don't know when activated users first see an upgrade prompt — pull that number before running any other experiment.`
        : tier === 'high'
        ? `At ${usd(dealSize)}/mo, the person who activates is rarely the person who approves the spend. The conversion block is ROI articulation and internal sell — not a better CTA. Users need a business case, not a pricing page.`
        : `At ${usd(dealSize)}/mo, users are making a conscious cost-benefit decision. The upgrade moment is almost certainly timed wrong — appearing at trial expiry instead of at the point where users feel the value most acutely.`;
      return `${activationRate}% of trial users are reaching core value — ${activatedUsers.toLocaleString()} users/month who understand what your product does. Only ${conversionRate}% are paying for it.${salesLine} So what: ${notConverting.toLocaleString()} activated users per month are disengaging from the buying process, not the product. Product-market fit is working. The revenue architecture downstream of it is not. Why: ${whyLine}`;
    },

    getRecommendation(inputs) {
      const { dealSize } = inputs;
      const tier = acvTier(dealSize);
      if (tier === 'high') {
        return `Build the ROI narrative and the upgrade pathway before anything else — at ${usd(dealSize)}/mo, conversion requires a business justification users can take to a budget owner. Do not run CRO experiments on your pricing page before building this. You are optimising a step that is not the bottleneck.`;
      }
      return `Fix when and where activated users first see an upgrade prompt — move it to immediately after the activation event, not at trial expiry. Do not A/B test pricing page copy before you know this timing. Copy optimisation on a badly timed CTA will not move conversion.`;
    },

    getActions(inputs) {
      const { dealSize, activationRate, trials } = inputs;
      const tier = acvTier(dealSize);
      return [
        {
          title: 'Step 1 — Map when activated users first see an upgrade prompt relative to their activation event',
          body: 'Most companies surface upgrade CTAs at trial expiry or on a standalone pricing page — not at the moment of peak engagement. Pull the sequence: when does an activated user first encounter a paid prompt relative to when they activated? If it\'s more than 48 hours later, you\'re letting the value window close. The upgrade CTA should appear immediately after the activation event, while the value is still being felt. This single timing change typically moves conversion more than any copy or pricing test.',
        },
        {
          title: tier === 'high'
            ? 'Step 2 — Build a shareable ROI summary for activated users to take to their stakeholders'
            : 'Step 2 — Replace your trial-end email sequence with a personalised value recap',
          body: tier === 'high'
            ? `At ${usd(dealSize)}/mo, the person who activates often isn\'t the person who signs off on budget. Build a one-page summary — what the user accomplished in the trial, what the paid product would enable beyond that, and a clear cost-per-outcome figure — that activated users can forward internally. Make the internal sell easy. This is the missing step in most high-ACV PLG funnels.`
            : 'The standard "your trial is expiring" email converts poorly. Replace it with a message that shows the user specifically what they accomplished during the trial — tasks completed, outputs created, value delivered — paired with a single upgrade CTA. Making the value tangible in their own product terms before asking for money typically improves trial-end conversion by 20–40%.',
        },
        {
          title: 'Step 3 — Run a pricing page teardown against three direct competitors',
          body: 'Compare how competitors at your price point present the free-to-paid value gap. Are they leading with outcomes or features? Is the upgrade framed as an investment or a cost? Benchmark on: clarity of the value gap, trust signals (logos, case study snippets), and friction to purchase. Most teams discover one area is significantly weaker than the market standard — that\'s your first fix, and it\'s almost always faster than A/B testing copy against a broken structure.',
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
      const gap = usd(Math.round(trials * 0.20) * dealSize - Math.round(trials * conversionRate / 100) * dealSize);
      return `${conversionRate}% conversion means ${(100 - conversionRate).toFixed(0)}% of ${trials.toLocaleString()} monthly trials are not becoming customers. The gap between your current ${currentMRR}/mo and a 20% conversion rate (${mrrAt20}/mo) is ${gap}/mo of revenue you can't capture until you know which problem you're solving. So what: an activation problem and a monetisation problem look identical at the conversion rate level — but the fixes are completely different. Investing in the wrong one costs you a quarter. Why this is the priority now: the tempting moves — pricing page tests, CTA changes, upgrade email tweaks — are all guesses about root cause. You don't need experiments yet. You need a diagnosis.`;
    },

    getRecommendation(inputs) {
      const { trials } = inputs;
      return `Add your activation rate — it is the single number that tells you whether to fix onboarding or upgrade mechanics. Do not run any conversion experiments until you have it. This is a one-week instrumentation task. Running tests without knowing root cause is how teams spend 90 days optimising the wrong variable and then can't explain flat results to leadership.`;
    },

    getActions() {
      return [
        {
          title: 'Step 1 — Instrument and measure your activation rate this week',
          body: 'Define your activation event: the single in-product action that best predicts paid conversion. Ask customer success or your sales team which usage patterns correlate with renewals and retention. Pull the data: what % of trials in the last 60 days reached it within 7 days? Below 35% → your primary problem is activation. Above 35% → your primary problem is monetisation mechanics. This single number determines your growth priority for the next quarter.',
        },
        {
          title: 'Step 2 — Interview 5 churned trials and 5 paying customers in the same week',
          body: 'Ask churned trials: "What were you hoping to accomplish, and what specifically stopped you?" Ask paying customers: "What made you decide to pay, and what nearly stopped you?" Run both sets in parallel — the contrast between them surfaces your funnel leak more precisely than any quantitative analysis. Budget 30 minutes per person. The patterns emerge clearly within 10 interviews and will give you a sharper hypothesis than any dashboard.',
        },
        {
          title: 'Step 3 — Map your full trial experience and assess every touchpoint against a single test',
          body: 'Document every interaction a trial user has from day 1 to expiry: in-app prompts, emails, upgrade CTAs, empty states. For each one, ask: does this move the user toward value, toward paying, or neither? Most SaaS products have a trial experience with no coherent narrative — disconnected nudges added reactively over time. Use this map to sequence your Step 1 and 2 findings into a prioritised fix list. Architecture first, then individual touchpoints.',
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
      const unitEconomicsLine = tier === 'low'
        ? `At ${usd(dealSize)}/mo, a fully-loaded sales touch — rep time, tooling, management overhead — costs more than the first-year gross margin on most of these deals. This is a unit economics problem, not a scale problem.`
        : tier === 'high'
        ? `At ${usd(dealSize)}/mo, individual sales touches are commercially justifiable. But growth velocity is headcount-constrained — every increment of new revenue requires a proportional increment of sales capacity.`
        : `At ${usd(dealSize)}/mo, individual sales touches can be justified on margin. But it means revenue scales with your sales team size, not with your product adoption.`;
      return `Your reported conversion rate is ${conversionRate}%. Strip out the ${salesAssistedPct}% of deals that required sales involvement and your true self-serve conversion rate is ${selfServeRate}% — ${selfServePaid.toLocaleString()} customers/month without any sales input. So what: your PLG motion is a lead source for sales, not a self-sufficient revenue engine. PLG-as-lead-gen scales with headcount. PLG-as-revenue-engine scales with product. ${unitEconomicsLine} Why: self-serve conversion mechanics haven't been built because sales has been compensating for their absence. Every quarter this continues, the gap between your current state and a real PLG motion widens — and the product debt compounds silently.`;
    },

    getRecommendation(inputs) {
      const { dealSize, salesAssistedPct } = inputs;
      const tier = acvTier(dealSize);
      if (tier === 'low') {
        return `Rebuild self-serve conversion mechanics now — at ${usd(dealSize)}/mo, sales-assisted conversion is economically unsustainable and is masking a product gap. Do not scale your sales team further before fixing self-serve. You will increase headcount costs and compress margins without closing the underlying capability gap.`;
      }
      if (tier === 'high') {
        return `Build a parallel self-serve path alongside your sales motion — you need both. Do not treat this exclusively as a sales efficiency problem. The goal is not to make sales cheaper. It is to build a conversion path that operates independently of your sales team's capacity.`;
      }
      return `Identify the top 3 reasons sales is being called in and build product fixes for each. Do not add sales headcount as your primary growth investment — revenue will scale, but so will costs, and your ${salesAssistedPct}% dependency will be harder to unwind the longer you wait.`;
    },

    getActions(inputs) {
      const { salesAssistedPct, dealSize, conversionRate } = inputs;
      const tier = acvTier(dealSize);
      const targetPct = Math.max(15, salesAssistedPct - 20);
      return [
        {
          title: 'Step 1 — Audit why sales is being called in and categorise the top 3 reasons',
          body: 'Pull your last 20 sales-assisted deals and ask your reps: "What question or objection would have prevented your involvement if the product had already answered it?" Most sales involvement falls into 3–4 recurring categories: pricing clarity, security or compliance questions, integration concerns, or internal sign-off support. Each one is a product or content gap — not an irreducible need for human contact. These categories are your self-serve product roadmap.',
        },
        {
          title: 'Step 2 — Build a complete self-serve upgrade flow for your most common deal tier',
          body: `Most companies build a sales motion first and never build a parallel self-serve path. Create a fully self-serve upgrade flow for deals around ${usd(dealSize)}/mo: a clear pricing page, frictionless checkout, instant provisioning, and a plain feature comparison. Run it alongside your current sales process for 60 days and measure what % of the next cohort completes it without a touch. That number is your true PLG baseline — and everything you build from here targets improving it.`,
        },
        {
          title: tier === 'low'
            ? `Step 3 — Set a 90-day target to reduce sales-assist from ${salesAssistedPct}% to ${targetPct}% and track it as a product health metric`
            : 'Step 3 — Define which deal segments should be self-serve vs. sales-assisted and build different upgrade flows for each',
          body: tier === 'low'
            ? `At ${usd(dealSize)}/mo, every sales-assisted conversion is compressing margin. Treat sales-assist % as a primary product metric — it belongs in the same dashboard as activation rate and conversion rate. Set a quarterly target (${salesAssistedPct}% → ${targetPct}%) and assign the reduction to product, not sales ops. If it\'s a sales ops metric, the product team will never own it.`
            : `At your ACV, not every deal needs to be self-serve — that\'s commercially rational. But you need clarity about which segments go which route. Define the segmentation: e.g. deals under ${usd(Math.round(dealSize / 2))}/mo are self-serve; above that, a sales touch is offered. Build distinct onboarding and upgrade flows for each segment. Stop treating every conversion identically.`,
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
      const severity = conversionRate < 14 ? 'clearly underperforming' : conversionRate < 17 ? 'average' : 'approaching strong but not there yet';
      const activationLine = activationRate != null
        ? activationRate < 40
          ? ` Your activation rate of ${activationRate}% is the primary drag — users who don't activate don't convert, and activation improvement delivers the fastest, most durable gains at this conversion level.`
          : ` Your activation rate of ${activationRate}% is healthy. The conversion shortfall is a monetisation mechanics issue — the value is landing, but the commercial pathway that should follow it isn't firing.`
        : ` Without activation data, you can't tell whether the friction is pre- or post-value moment — and that distinction determines your entire fix. Add activation rate before running any experiments.`;
      const salesMaskLine = salesAssistedPct != null && salesAssistedPct > 35
        ? ` Critical: with ${salesAssistedPct}% sales assist, your true self-serve conversion rate is approximately ${(conversionRate * (1 - salesAssistedPct / 100)).toFixed(1)}%. That is the number that tells you how your PLG motion is actually performing — and it is materially lower than the ${conversionRate}% headline figure.`
        : '';
      return `${conversionRate}% conversion is ${severity}. ${gapCustomers} additional customers and ${gapMRR}/mo is reachable without changing a single acquisition input.${activationLine}${salesMaskLine} So what: you have a working conversion engine with specific, identifiable friction. This is not a strategic problem — it is a prioritisation and sequencing problem. Find the two or three highest-cost friction points and remove them in order.`;
    },

    getRecommendation(inputs) {
      const { activationRate, conversionRate } = inputs;
      if (activationRate != null && activationRate < 40) {
        return `Fix activation before running any conversion experiments — at ${activationRate}% you are losing potential conversions before users reach the monetisation decision, and downstream experiments will produce noise, not signal. Do not run a pricing redesign or packaging overhaul. At ${conversionRate}% conversion, the problem is friction and timing — not price.`;
      }
      return `Run one structured conversion experiment per trial cycle, starting with the trial-end experience. Do not run multiple experiments simultaneously — you will get noise, not signal, and waste 2–3 trial cycles before you can act on anything. The trial-end window is almost always the highest-return place to start.`;
    },

    getActions(inputs) {
      const { dealSize, activationRate, conversionRate, trials, salesAssistedPct } = inputs;
      const tier = acvTier(dealSize);
      const actions = [];
      const stepNum = () => `Step ${actions.length + 1}`;

      if (activationRate != null && activationRate < 40) {
        actions.push({
          title: `${stepNum()} — Fix the activation gap before running any conversion experiments`,
          body: `${Math.round(trials * (1 - activationRate / 100)).toLocaleString()} trial users per month never experience what you\'re selling. Run a cohort analysis: what did users who converted do in their first 72 hours that churned users didn\'t? That behavioural difference is your activation intervention. Fix the activation leak first — experiments downstream of this problem will produce weak signal until it\'s resolved.`,
        });
      }

      actions.push({
        title: `${stepNum()} — Segment your conversion rate by acquisition channel and ICP fit`,
        body: `Your ${conversionRate}% likely masks significant variation. Some channels may convert at 25%+ while others pull the average down. Pull trial-to-paid conversion by acquisition source and, if possible, by company size or ICP fit. Reallocating budget toward your highest-converting segments will lift the overall rate without a single product change — and tells you exactly which experiments to run first, on whom.`,
      });

      actions.push({
        title: `${stepNum()} — Build a prioritised conversion experiment backlog and run one test per trial cycle`,
        body: 'Document specific, testable hypotheses (e.g. "personalised value recap before the upgrade CTA will lift conversion by 15%"). Run one per full trial cycle — long enough to capture genuine conversion signal, not just click-through rates. After 3 cycles you\'ll have a repeatable optimisation process and a data-backed view of your biggest levers. The trial-end experience and the upgrade CTA timing are almost always the highest-return experiments to start with.',
      });

      if (actions.length < 3) {
        actions.push({
          title: `${stepNum()} — Redesign your trial-end experience around personalised value evidence`,
          body: 'The final 48 hours of a trial are the highest-leverage conversion window most products consistently underuse. Build a trial-end flow that shows users exactly what they accomplished — not what they could do — paired with a single upgrade CTA. Personalisation using actual usage data outperforms generic expiry sequences by 2–4× in B2B SaaS and typically requires less engineering than teams expect.',
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
        ? ` Important caveat: ${salesAssistedPct}% sales assist means a significant share of that ${conversionRate}% is sales-driven, not product-led. Confirm your true self-serve conversion rate before building a pure self-serve acquisition strategy — the channel mix depends on which motion is actually converting.`
        : '';
      const activationAnomalyLine = activationRate != null && activationRate < T.activationWeak
        ? ` Non-obvious flag: your activation rate of ${activationRate}% is unusually low for a ${conversionRate}% conversion rate. This pattern usually means one of two things: your activation event is defined incorrectly and isn't measuring real value attainment, or sales is compensating for a product experience that wouldn't hold self-serve. Verify before scaling spend — you will find out at scale if it's the latter.`
        : '';
      return `${conversionRate}% conversion is strong. Your product-market fit and monetisation engine are working. The constraint is volume. At ${trials.toLocaleString()} monthly trials, you are running a high-efficiency, low-throughput funnel. Scaling to 500 trials/month at your current rate adds approximately ${addedMRR}/mo without changing anything downstream. So what: the growth question has moved from "does our funnel work?" to "how do we fill it faster?" The funnel is ready. The pipe isn't.${salesLine}${activationAnomalyLine}`;
    },

    getRecommendation(inputs) {
      const { salesAssistedPct, conversionRate } = inputs;
      if (salesAssistedPct != null && salesAssistedPct > 40) {
        return `Scale acquisition — but build self-serve channels in parallel with sales-assisted ones. Do not pour budget into channels that primarily generate sales leads without also building self-serve conversion paths. You will hit a headcount ceiling before a revenue ceiling.`;
      }
      return `Invest aggressively in top-of-funnel now — your unit economics justify it and your conversion engine can absorb significantly more volume. Do not spend more time optimising conversion rate. At ${conversionRate}%+, marginal conversion improvement returns very little. The growth multiplier is volume, not efficiency.`;
    },

    getActions(inputs) {
      const { conversionRate, trials, dealSize, salesAssistedPct } = inputs;
      const tier = acvTier(dealSize);
      return [
        {
          title: 'Step 1 — Identify your highest-converting acquisition channel and build a repeatable playbook for it',
          body: `Pull the last 3 months of paid conversions by acquisition source. Find the channel with the highest trial-to-paid conversion rate — not just the highest trial volume. At ${conversionRate}% overall, your best channel is likely converting at 25–35%+. Document the ICP, messaging, format, and conversion asset for that channel, then build a playbook that lets you scale it without degrading quality. Do this before diversifying into new channels — premature diversification is how companies with strong conversion rates stall at growth.`,
        },
        {
          title: 'Step 2 — Build a product-led referral loop into your core activation flow',
          body: 'Your paying customers are your cheapest acquisition channel and the one most companies underuse at this stage. Find the moment in your product where users derive the most value — the point where they\'d naturally want to share or involve a colleague. Add a referral or invite mechanism there as a native part of the product experience, not a standalone campaign. In-product referral at the value moment generates trials that convert at 2–3× the rate of paid channels, at near-zero CAC.',
        },
        {
          title: tier === 'high'
            ? 'Step 3 — Build a warm outbound motion using product-usage signals from non-converting trials'
            : 'Step 3 — Test a free tier or freemium entry point to remove the trial barrier for hesitant buyers',
          body: tier === 'high'
            ? `At ${usd(dealSize)}/mo, your deal size justifies targeted outbound. Use product-usage data — users who activated but didn\'t convert, or who churned after day 7 — as your outbound list. This is warm outbound with a genuine, specific hook ("I noticed you used X during your trial") and converts at significantly higher rates than cold sequences with the same ICP targeting.`
            : `With a strong conversion engine, the fastest way to grow trial volume is to lower the barrier to starting. A free tier removes the time commitment of a trial entirely. Run a 90-day test: measure trial starts, activation rate, and conversion of free users. If your product delivers value quickly (which your conversion rate suggests it does), freemium typically multiplies top-of-funnel volume without meaningfully diluting conversion among users who activate.`,
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
        ? ` Structural risk: ${salesAssistedPct}% sales assist means a significant share of your conversion efficiency is sales-driven. At scale, that becomes a headcount ceiling. The self-serve infrastructure that should underpin this motion hasn't been built because sales has been compensating — and that gap compounds.`
        : '';
      const activationLine = activationRate != null && activationRate < 45
        ? ` Remaining efficiency gap: ${activationRate}% activation rate — lifting this is your highest-ROI conversion lever and requires no additional acquisition spend.`
        : '';
      return `${conversionRate}% conversion across ${trials.toLocaleString()} monthly trials is a strong PLG foundation — ~${annualMRR} in annualised new-customer MRR.${activationLine}${salesLine} So what: the funnel works. Your priorities have shifted. The three risks that compound from here: (1) conversion dilution as you scale into broader audiences — blended conversion declines quietly without cohort-level tracking; (2) under-investment in expansion relative to new ARR — most companies at this stage leave 30–40% of achievable growth on the table here; (3) CAC creep as efficient acquisition channels saturate. The work has changed from building a funnel to protecting one.`;
    },

    getRecommendation(inputs) {
      const { activationRate, salesAssistedPct } = inputs;
      if (salesAssistedPct != null && salesAssistedPct > 40) {
        return `Build self-serve conversion infrastructure now, before sales capacity becomes your growth ceiling. Do not scale acquisition or headcount before the self-serve path exists. You will scale costs and complexity faster than revenue.`;
      }
      if (activationRate != null && activationRate < 45) {
        return `Close the activation gap first, then shift investment toward retention and expansion. Do not pour incremental budget into acquisition before fixing activation — you are leaving compounding conversion gains on the table that cost nothing to capture.`;
      }
      return `Shift investment toward retention and expansion revenue — NRR and LTV optimisation will generate more growth per dollar than further acquisition at your conversion rate. Do not pursue growth through discounting or promotional pricing. It compresses LTV, attracts price-sensitive buyers who churn faster, and masks real growth health in the reporting.`;
    },

    getActions(inputs, metrics) {
      const { conversionRate, trials, dealSize, activationRate, salesAssistedPct } = inputs;
      const tier = acvTier(dealSize);
      const convFloor = Math.max(18, conversionRate - 2);
      return [
        {
          title: 'Step 1 — Set a conversion rate floor and track cohort-level conversion weekly',
          body: `Conversion dilution is the silent growth killer at scale — you broaden ICP, add acquisition channels, run more experiments, and ${conversionRate}% quietly becomes 15% over 18 months without anyone declaring it a crisis. Set a floor (e.g. ${convFloor}%) that triggers a structured review if breached. Track conversion weekly by cohort, channel, and ICP segment — not just as a blended average. Catching dilution early costs 10× less to fix than discovering it after two quarters of scaled acquisition spend.`,
        },
        {
          title: 'Step 2 — Build a systematic expansion revenue motion for your top 20% of customers',
          body: 'At your stage, expansion MRR typically represents 30–40% of net new ARR in high-growth SaaS — and most companies at your conversion rate under-invest in it because new acquisition still feels more exciting. Identify your top 20% of customers by usage depth and product engagement. Build a deliberate expansion playbook: trigger-based upsell prompts at usage thresholds, structured success reviews at 90 days, and an expansion-qualified lead (EQL) definition for your CS team. This is your highest-ROI growth motion that most companies at your stage aren\'t running.',
        },
        {
          title: activationRate != null && activationRate < 45
            ? 'Step 3 — Run a focused activation improvement sprint before your next acquisition push'
            : 'Step 3 — Invest in a second acquisition channel before your primary shows saturation signs',
          body: activationRate != null && activationRate < 45
            ? `You have strong conversion among activated users, but ${(100 - activationRate).toFixed(0)}% of trials never activate. A focused 6-week sprint — aimed specifically at time-to-value and onboarding friction — run alongside current acquisition spend will likely add more MRR than an equivalent increase in paid acquisition budget. Run it before scaling spend further, while your conversion rate is still clean enough to measure the impact clearly.`
            : `Channel concentration is a compounding risk at scale. If more than 50% of your trials come from one source, build a second before the primary shows saturation. The time to invest in a new channel is when the primary is still performing well — not after CPAs start rising. Identify your second-best converting source and run a structured 90-day scaling experiment to establish its cost curve and ICP fit at your current conversion rate.`,
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
