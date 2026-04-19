import { z } from "zod";
import { asyncHandler, HttpError } from "../utils/http.js";
import {
  appendMessage,
  getConversation,
  getOrCreateConversation,
  updateContext,
} from "../services/pipeline/sessionManager.js";

// Utility: split query into intent + disease
function parseQuery(query, explicitDisease) {
  // If disease is already provided explicitly, use it
  if (explicitDisease) {
    return { intent: query, disease: explicitDisease };
  }

  // Naive split: look for "for" or "in" to separate
  const lower = query.toLowerCase();
  if (lower.includes(" for ")) {
    const [intentPart, diseasePart] = query.split(/ for /i);
    return { intent: intentPart.trim(), disease: diseasePart.trim() };
  }
  if (lower.includes(" in ")) {
    const [intentPart, diseasePart] = query.split(/ in /i);
    return { intent: intentPart.trim(), disease: diseasePart.trim() };
  }

  // Fallback: treat whole query as intent
  return { intent: query, disease: "" };
}

const QueryBodySchema = z.object({
  sessionId: z.string().optional(),
  patientName: z.string().optional(),
  disease: z.string().optional(),
  query: z.string().min(1),
  location: z.string().optional(),
});

const FollowUpBodySchema = z.object({
  sessionId: z.string().min(1),
  patientName: z.string().optional(),
  disease: z.string().optional(),
  query: z.string().min(1),
  location: z.string().optional(),
});

export function createQueryController({ pipeline }) {
  const postQuery = asyncHandler(async (req, res) => {
    const parsed = QueryBodySchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid body", parsed.error.flatten());

    const { sessionId, patientName, disease, query, location } = parsed.data;
    const convo = await getOrCreateConversation({ sessionId, patientName, disease, location });

    await appendMessage(convo.sessionId, "user", {
      patientName: patientName || "",
      disease: disease || "",
      query,
      location: location || "",
    });

    // 🔹 Parse query into intent + disease
    const { intent, disease: parsedDisease } = parseQuery(query, disease);

    const result = await pipeline.run({
      patientName: patientName || convo.patientName || "",
      disease: parsedDisease || convo.disease || "",
      intent,
      location: location || convo.location || "",
    });

    await appendMessage(convo.sessionId, "assistant", result.answer);
    await updateContext(convo.sessionId, {
      patientName: result.parsed.patientName || convo.patientName || "",
      disease: result.parsed.disease || convo.disease || "",
      location: result.parsed.location || convo.location || "",
      lastQuery: result.parsed.query,
    });

    res.json({
      sessionId: convo.sessionId,
      parsed: result.parsed,
      expandedQueries: result.expandedQueries,
      retrievalErrors: result.retrievalErrors,
      ranked: result.ranked,
      answer: result.answer,
    });
  });

  const postFollowUp = asyncHandler(async (req, res) => {
    const parsed = FollowUpBodySchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid body", parsed.error.flatten());

    const { sessionId, query: followUpQuery, patientName, disease, location } = parsed.data;
    const convo = await getConversation(sessionId);
    if (!convo) throw new HttpError(404, "Session not found");

    await appendMessage(sessionId, "user", {
      patientName: patientName || "",
      disease: disease || "",
      query: followUpQuery,
      location: location || "",
    });

    // 🔹 Parse follow-up query into intent + disease
    const { intent, disease: parsedDisease } = parseQuery(followUpQuery, disease);

    const result = await pipeline.runFollowUp({
      previousPatientName: convo.patientName,
      previousDisease: convo.disease,
      previousLocation: convo.location,
      followUpQuery,
      explicitPatientName: patientName,
      explicitDisease: parsedDisease,
      explicitLocation: location,
      intent,
    });

    await appendMessage(sessionId, "assistant", result.answer);
    await updateContext(sessionId, {
      patientName: result.parsed.patientName || convo.patientName || "",
      disease: result.parsed.disease || convo.disease || "",
      location: result.parsed.location || convo.location || "",
      lastQuery: result.parsed.query,
    });

    res.json({
      sessionId,
      parsed: result.parsed,
      expandedQueries: result.expandedQueries,
      retrievalErrors: result.retrievalErrors,
      ranked: result.ranked,
      answer: result.answer,
    });
  });

  return { postQuery, postFollowUp };
}
