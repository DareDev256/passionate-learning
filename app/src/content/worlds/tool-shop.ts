import type { World } from "../types";

// Ported from Tool Match (legacy suite) on 2026-10-03.
export const toolShop: World = {
  id: "tools",
  title: "Tool Shop",
  tagline: "Pick the right tool. Sometimes it's not AI.",
  accent: "#0fa968",
  guide: { pose: "present", face: "grin", wear: ["hero"] },
  from: "Tool Match",
  status: "live",
  units: [
    { id: "words", title: "Word jobs", blurb: "Writing, reading, translating.", cards: [
        { id: "tt-001", type: "choice", prompt: "Summarize a 50-page legal contract into key points. Best tool?", options: ["A chatbot (ChatGPT, Claude)", "A coding assistant", "A search engine", "Don't use AI. Do it yourself."], answer: 0, why: "LLMs excel at distilling long documents. This saves hours of manual reading." },
        { id: "tt-002", type: "choice", prompt: "Transcribe a 2-hour recorded interview into text. Best tool?", options: ["A chatbot (ChatGPT, Claude)", "Speech-to-text (like Whisper)", "A coding assistant", "Don't use AI. Do it yourself."], answer: 1, why: "Speech-to-text models like Whisper are purpose-built for transcription." },
        { id: "tt-003", type: "choice", prompt: "Write a sympathy card for a coworker who lost a family member. Best tool?", options: ["A chatbot (ChatGPT, Claude)", "An AI image generator", "A search engine", "Don't use AI. Do it yourself."], answer: 3, why: "Genuine emotion can't be outsourced. AI condolences risk being discovered and causing more hurt." },
        { id: "tt-004", type: "choice", prompt: "Translate a restaurant menu from French to English. Best tool?", options: ["A chatbot (ChatGPT, Claude)", "A search engine", "A human expert", "Don't use AI. Do it yourself."], answer: 0, why: "LLMs handle common language translation well, especially for informal content." },
        { id: "tt-005", type: "choice", prompt: "Draft a professional resignation letter. Best tool?", options: ["A chatbot (ChatGPT, Claude)", "A coding assistant", "A spreadsheet", "Don't use AI. Do it yourself."], answer: 0, why: "AI can generate professional templates. A resignation letter is formulaic enough for AI." },
        { id: "tt-006", type: "choice", prompt: "Proofread your wedding vows for grammar mistakes. Best tool?", options: ["A chatbot (ChatGPT, Claude)", "A search engine", "A human expert", "Don't use AI. Do it yourself."], answer: 3, why: "AI might 'fix' your authentic voice into generic language. Vows should sound like YOU." },
        { id: "tt-007", type: "choice", prompt: "Generate 20 blog post title ideas about sustainable fashion. Best tool?", options: ["A chatbot (ChatGPT, Claude)", "An AI image generator", "A search engine", "Don't use AI. Do it yourself."], answer: 0, why: "Brainstorming is one of AI's strongest use cases: volume of ideas with zero writer's block." },
        { id: "tt-008", type: "choice", prompt: "Find out what time the Super Bowl starts this Sunday. Best tool?", options: ["A chatbot (ChatGPT, Claude)", "A search engine", "A spreadsheet", "Don't use AI. Do it yourself."], answer: 1, why: "LLMs have knowledge cutoffs. Real-time event data needs a search engine." },
    ] },
    { id: "pictures", title: "Picture jobs", blurb: "Images, charts, and art.", cards: [
        { id: "vt-001", type: "choice", prompt: "Create a mood board of color palettes for a beach resort brand. Best tool?", options: ["A chatbot (ChatGPT, Claude)", "An AI image generator", "A coding assistant", "Don't use AI. Do it yourself."], answer: 1, why: "Image generators excel at visual concept exploration and mood boards." },
        { id: "vt-002", type: "choice", prompt: "Design a company logo that will be trademarked. Best tool?", options: ["An AI image generator", "A chatbot (ChatGPT, Claude)", "A human expert", "Don't use AI. Do it yourself."], answer: 3, why: "AI-generated images have unclear copyright status. Trademarking AI art is legally murky." },
        { id: "vt-003", type: "choice", prompt: "Generate concept art for a sci-fi video game environment. Best tool?", options: ["An AI image generator", "A chatbot (ChatGPT, Claude)", "A coding assistant", "Don't use AI. Do it yourself."], answer: 0, why: "AI image generation is perfect for rapid concept exploration in early creative phases." },
        { id: "vt-004", type: "choice", prompt: "Create a chart showing quarterly revenue by region. Best tool?", options: ["A chatbot (ChatGPT, Claude)", "An AI image generator", "A spreadsheet", "Don't use AI. Do it yourself."], answer: 2, why: "Spreadsheets are purpose-built for data visualization. AI image generators can't process real data." },
        { id: "vt-005", type: "choice", prompt: "Sketch a portrait of your best friend as a birthday gift. Best tool?", options: ["An AI image generator", "A chatbot (ChatGPT, Claude)", "A human expert", "Don't use AI. Do it yourself."], answer: 3, why: "A personal gift carries meaning because YOU made it. AI removes the personal touch." },
        { id: "vt-006", type: "choice", prompt: "Generate 10 social media banner variations for A/B testing. Best tool?", options: ["An AI image generator", "A chatbot (ChatGPT, Claude)", "A spreadsheet", "Don't use AI. Do it yourself."], answer: 0, why: "AI can rapidly produce visual variations, perfect for A/B testing at scale." },
        { id: "vt-007", type: "choice", prompt: "Photo-edit a deceased relative into a family photo they missed. Best tool?", options: ["An AI image generator", "A chatbot (ChatGPT, Claude)", "A human expert", "Don't use AI. Do it yourself."], answer: 3, why: "This raises deep ethical questions about consent, grief processing, and digital manipulation." },
    ] },
  ],
};
