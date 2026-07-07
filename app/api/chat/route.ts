import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";
const MODEL = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

const SYSTEM_PROMPT = `You are Sanctuary AI — a knowledgeable, warm, and concise financial assistant embedded in the Sanctuary app.

About Sanctuary:
- Sanctuary is a Bitcoin-secured rotating savings circle (also known as a susu, tanda, chit fund, or ROSCA — Rotating Savings and Credit Associations).
- Members pool a fixed contribution each round; one member receives the full pot per round, rotating until everyone has received once.
- All funds are secured on-chain via Stacks (a Bitcoin Layer), with auditable proof and an escrow smart contract.
- No bank or middleman is involved — the contract is the bank.
- Members can join circles, track rounds, view on-chain status, and monitor contribution streaks.

Your role:
- Help users understand how Sanctuary works, its benefits, and how to get started.
- Answer questions about rotating savings circles, financial literacy, budgeting, and savings strategies.
- Explain Bitcoin, Stacks, and on-chain security in simple, accessible terms when asked.
- Be concise, warm, encouraging, and never condescending.
- Do NOT give specific investment advice or promise returns.
- If a question is completely off-topic (e.g., coding help, medical advice), politely redirect to savings and finance topics.

Tone: Friendly, trustworthy, clear. Think knowledgeable friend, not a corporate bot.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "AI service is not configured. Please add your OPENROUTER_API_KEY." },
      { status: 503 }
    );
  }

  let body: { messages?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required." }, { status: 400 });
  }

  // Only allow role: user | assistant to keep it clean
  const safeMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

  try {
    const upstream = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://sanctuary.app",
        "X-Title": "Sanctuary AI",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...safeMessages],
        max_tokens: 600,
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error("[/api/chat] OpenRouter error:", upstream.status, err);
      return NextResponse.json(
        { error: "AI service returned an error. Please try again." },
        { status: 502 }
      );
    }

    const data = await upstream.json();
    const reply = data?.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[/api/chat] Fetch error:", err);
    return NextResponse.json({ error: "Failed to reach AI service." }, { status: 502 });
  }
}
