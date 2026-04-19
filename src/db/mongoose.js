import mongoose from "mongoose";

export async function connectMongo(mongoUri, { logger } = {}) {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => logger?.info?.("Mongo connected"));
  mongoose.connection.on("error", (err) => logger?.error?.("Mongo error", err));
  mongoose.connection.on("disconnected", () => logger?.warn?.("Mongo disconnected"));

  await mongoose.connect(mongoUri, {
    autoIndex: process.env.NODE_ENV !== "production",
  });
}

