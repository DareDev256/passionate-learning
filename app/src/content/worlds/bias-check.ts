import type { World } from "../types";

export const biasCheck: World = {
  id: "bias",
  title: "Bias Check",
  tagline: "Spot when AI treats people unfairly, and why it happens.",
  accent: "#8a4dff",
  guide: { pose: "think", face: "flat", wear: ["hero", "glasses"] },
  from: "Bias Buster",
  status: "live",
  units: [
    {
      id: "where-from",
      title: "Where bias comes from",
      blurb: "AI learns from us. Including our blind spots.",
      cards: [
        {
          id: "bc-001", type: "choice",
          prompt: "An AI learned from old hiring data where most engineers hired were men. What might it do?",
          options: ["Pick the best candidates fairly", "Favour men, because that's the pattern it learned", "Refuse to work"],
          answer: 1,
          why: "AI copies patterns in its training data, unfair ones included. Old bias in, new bias out.",
          meme: { kind: "expect", expectation: "AI is neutral, it's just maths", reality: "AI learned from history, and history wasn't fair" },
        },
        { id: "bc-002", type: "cap", claim: "Because it's a computer, an AI can't be biased.", isCap: true, why: "Cap. Models learn from human-made data. If the data is skewed, the model is too." },
        {
          id: "bc-003", type: "choice",
          prompt: "A face-unlock feature works great on some skin tones and badly on others. Most likely cause?",
          options: ["The camera is broken", "The training photos didn't include enough variety of faces", "Some people have bad phones"],
          answer: 1,
          why: "If some groups are missing from the training data, the model performs worse for them.",
        },
        {
          id: "bc-004", type: "choice",
          prompt: "Which training data would make a fairer model?",
          options: ["Photos from one country only", "A wide mix of people, ages, places and backgrounds", "Whatever was easiest to download"],
          answer: 1,
          why: "Diverse, representative data is one of the main ways to reduce bias.",
        },
        { id: "bc-005", type: "type", prompt: "When a system unfairly favours or disfavours a group, that's called ____.", accept: ["bias"], why: "Bias: a tilt in outcomes that isn't about merit." },
      ],
    },
    {
      id: "fix-it",
      title: "Catch it and fix it",
      blurb: "What builders and users can actually do.",
      cards: [
        {
          id: "bc-101", type: "order",
          prompt: "A team finds their AI is biased. Put a sensible fix in order:",
          steps: ["Measure how it performs for different groups", "Find where the gap comes from", "Fix the data or the model", "Test again before releasing"],
          why: "Measure, diagnose, fix, re-test. You can't fix what you didn't measure.",
        },
        {
          id: "bc-102", type: "choice",
          prompt: "An AI decides who gets a loan. What's the most important safeguard?",
          options: ["Nobody checks it, it's faster", "People can see why they were refused and get a human review", "Hide how it works"],
          answer: 1,
          why: "High-stakes decisions need explanations and a human who can overturn them.",
          meme: { kind: "drake", no: "computer says no, no reason given", yes: "here's why, and a human can review it" },
        },
        { id: "bc-103", type: "cap", claim: "Testing an AI on different groups of people can reveal bias that average accuracy hides.", isCap: false, why: "Facts. 95% accurate overall can still mean 70% for one group. Always break results down." },
        {
          id: "bc-104", type: "choice",
          prompt: "You notice an AI image generator always draws doctors as men. What can you do as a user?",
          options: ["Nothing, it's just how it is", "Ask for variety in your prompt and report the pattern", "Stop using computers"],
          answer: 1,
          why: "Prompt for what you want and report patterns. User feedback is how products get fixed.",
        },
        { id: "bc-105", type: "cap", claim: "Removing names from job applications automatically removes all bias from an AI screener.", isCap: true, why: "Cap. Other details like school, zip code or hobbies can stand in for the same thing. Bias hides in proxies." },
      ],
    },
  ],
};
