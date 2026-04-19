import crypto from "node:crypto";
import { Conversation } from "../../models/Conversation.js";

export function newSessionId() {
  return crypto.randomUUID();
}

export async function getConversation(sessionId) {
  if (!sessionId) return null;
  return await Conversation.findOne({ sessionId }).exec();
}

export async function getOrCreateConversation({ sessionId, patientName, disease, location }) {
  if (sessionId) {
    const existing = await Conversation.findOne({ sessionId }).exec();
    if (existing) return existing;
  }
  const convo = new Conversation({
    sessionId: sessionId || newSessionId(),
    patientName: patientName || "",
    disease: disease || "",
    location: location || "",
    messages: [],
  });
  await convo.save();
  return convo;
}

export async function appendMessage(sessionId, role, content) {
  await Conversation.updateOne(
    { sessionId },
    {
      $push: { messages: { role, content } },
      $set: { updatedAt: new Date() },
    }
  ).exec();
}

export async function updateContext(sessionId, { patientName, disease, location, lastQuery }) {
  const set = {};
  if (patientName !== undefined) set.patientName = patientName;
  if (disease !== undefined) set.disease = disease;
  if (location !== undefined) set.location = location;
  if (lastQuery !== undefined) set.lastQuery = lastQuery;
  await Conversation.updateOne({ sessionId }, { $set: set }).exec();
}

