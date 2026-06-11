import { Router, type IRouter } from "express";
import healthRouter from "./health";
import affiliatesRouter from "./affiliates";
import eventsRouter from "./events";
import conversionsRouter from "./conversions";
import payoutsRouter from "./payouts";
import statsRouter from "./stats";
import configRouter from "./config";
import portalRouter from "./portal";
import appsRouter from "./apps";
import productsRouter from "./products";
import trackingRouter from "./tracking";
import emailTemplatesRouter, { seedEmailTemplates } from "./email_templates";
import leadsRouter from "./leads";
import publicRouter from "./public";

const router: IRouter = Router();

router.use(healthRouter);
router.use(affiliatesRouter);
router.use(eventsRouter);
router.use(conversionsRouter);
router.use(payoutsRouter);
router.use(statsRouter);
router.use(configRouter);
router.use(portalRouter);
router.use(appsRouter);
router.use(productsRouter);
router.use(trackingRouter);
router.use(emailTemplatesRouter);
router.use(leadsRouter);
router.use(publicRouter);

seedEmailTemplates().catch(() => {});

export default router;
