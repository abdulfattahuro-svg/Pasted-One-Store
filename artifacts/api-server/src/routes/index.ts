import { Router, type IRouter } from "express";
import healthRouter from "./health";
import affiliatesRouter from "./affiliates";
import eventsRouter from "./events";
import conversionsRouter from "./conversions";
import payoutsRouter from "./payouts";
import statsRouter from "./stats";
import configRouter from "./config";

const router: IRouter = Router();

router.use(healthRouter);
router.use(affiliatesRouter);
router.use(eventsRouter);
router.use(conversionsRouter);
router.use(payoutsRouter);
router.use(statsRouter);
router.use(configRouter);

export default router;
