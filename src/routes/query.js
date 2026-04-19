import express from "express";
import { createQueryController } from "../controllers/queryController.js";

export function createQueryRouter({ pipeline }) {
  const router = express.Router();
  const controller = createQueryController({ pipeline });

  router.post("/query", controller.postQuery);
  router.post("/follow-up", controller.postFollowUp);

  return router;
}

