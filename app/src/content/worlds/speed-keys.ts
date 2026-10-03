import type { World } from "../types";

// Remastered from the TypeMaster AI prototype: type the term from its meaning. Spelling is forgiving on case and punctuation.
export const speedKeys: World = {
  id: "keys",
  title: "Speed Keys",
  tagline: "Type the tech word before your brain lets go of it.",
  accent: "#e5007e",
  guide: { pose: "type", face: "cool", wear: ["hero"] },
  from: "TypeMaster AI",
  status: "live",
  units: [
    {
      id: "ai-words",
      title: "AI words",
      blurb: "The vocab everyone pretends to know.",
      cards: [
        { id: "sk-001", type: "type", prompt: "The text you send to an AI.", accept: ["prompt"], why: "Prompt: your half of every AI conversation." },
        { id: "sk-002", type: "type", prompt: "A chunk of text an AI reads and writes, often part of a word.", accept: ["token"], why: "Tokens are how models count. Pricing and limits are measured in them." },
        { id: "sk-003", type: "type", prompt: "When an AI confidently makes something up.", accept: ["hallucination"], why: "Hallucination: fluent, confident, wrong." },
        { id: "sk-004", type: "type", prompt: "The setting that makes AI answers more random or more focused.", accept: ["temperature"], why: "Temperature: low for facts, high for poems." },
        { id: "sk-005", type: "type", prompt: "Three letters: Large Language Model.", accept: ["llm"], why: "LLM: the engine behind chatbots like ChatGPT and Claude." },
        { id: "sk-006", type: "type", prompt: "Training a model more on your own examples so it gets better at one job: fine-______.", accept: ["tuning", "fine-tuning", "fine tuning"], hint: "rhymes with crooning", why: "Fine-tuning teaches a general model a specific skill." },
      ],
    },
    {
      id: "safety-words",
      title: "Safety words",
      blurb: "The words that keep AI in check.",
      cards: [
        { id: "sk-101", type: "type", prompt: "Hiding instructions in content so an AI obeys them: prompt ________.", accept: ["injection"], why: "Prompt injection: the number one attack on AI apps." },
        { id: "sk-102", type: "type", prompt: "Tricking an AI into ignoring its safety rules.", accept: ["jailbreak", "jailbreaking", "jail break"], why: "Jailbreak: role-play and tricks to get past guardrails." },
        { id: "sk-103", type: "type", prompt: "Attacking your own system on purpose, with permission, to find weak spots: red ______.", accept: ["teaming", "team", "red teaming"], why: "Red teaming finds the holes before attackers do." },
        { id: "sk-104", type: "type", prompt: "Only giving a program the access it truly needs: least _________.", accept: ["privilege"], hint: "starts with priv", why: "Least privilege limits the damage when something goes wrong." },
        { id: "sk-105", type: "type", prompt: "Checking a claim against a trusted source: fact-________.", accept: ["checking", "check"], why: "Fact-checking beats trusting a confident chatbot." },
      ],
    },
    {
      id: "net-words",
      title: "Internet words",
      blurb: "How the web actually works, in single words.",
      cards: [
        { id: "sk-201", type: "type", prompt: "The system that turns names like google.com into number addresses. Three letters.", accept: ["dns"], why: "DNS is the internet's phonebook." },
        { id: "sk-202", type: "type", prompt: "The secure version of HTTP has an extra letter at the end. Type the whole thing.", accept: ["https"], why: "The S means the connection is encrypted." },
        { id: "sk-203", type: "type", prompt: "A device that sends traffic between networks, like your home internet box.", accept: ["router"], why: "Routers move packets between networks." },
        { id: "sk-204", type: "type", prompt: "A number address for a device on a network: __ address.", accept: ["ip", "ip address"], why: "Every device online has an IP address." },
        { id: "sk-205", type: "type", prompt: "Scrambling data so only the right person can read it.", accept: ["encryption", "encrypt"], why: "Encryption protects your messages and passwords in transit." },
      ],
    },
  ],
};
