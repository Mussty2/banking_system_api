import express from "express";

import { protect } from "../middlewares/auth.middleware.js";
import { allowRoles } from "../middlewares/role.middleware.js";
import { uploadDocument } from "../middlewares/documentUpload.middleware.js";

import {
  submitDocument,
  getMyDocuments,
  getPendingDocuments,
  reviewDocument,
} from "../controllers/document.controller.js";

const router = express.Router();

router.post(
  "/submit",
  protect,
  allowRoles("customer"),
  uploadDocument,
  submitDocument
);

router.get(
  "/my-documents",
  protect,
  allowRoles("customer"),
  getMyDocuments
);

router.get(
  "/pending",
  protect,
  allowRoles("manager", "admin"),
  getPendingDocuments
);

router.patch(
  "/:id/review",
  protect,
  allowRoles("manager", "admin"),
  reviewDocument
);

export default router;
