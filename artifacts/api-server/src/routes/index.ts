import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stripeRouter from "./stripe";
import adminRouter from "./admin";
import reportsRouter from "./reports";
import topicsRouter from "./topics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stripeRouter);
router.use(adminRouter);
router.use(reportsRouter);
router.use(topicsRouter);

export default router;
