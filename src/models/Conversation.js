import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

const ConversationSchema = new mongoose.Schema(
  {
    sessionId: { type: String, index: true, unique: true, required: true },
    patientName: { type: String, default: "" },
    disease: { type: String, default: "" },
    location: { type: String, default: "" },
    messages: { type: [MessageSchema], default: [] },
    lastQuery: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Conversation =
  mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);

