import { Router } from "express";

import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { healthcheck } from "../controllers/healthcheck.controller.js";

const router = Router()

router.use( verifyJWT );

router.route("/").post(healthcheck)

export default router