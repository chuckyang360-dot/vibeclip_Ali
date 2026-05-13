import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import ShortDramaLanding from "../pages/short-drama/landing/page";
import CreateProjectPage from "../pages/short-drama/create/page";
import Step1Page from "../pages/short-drama/step1/page";
import Step2Page from "../pages/short-drama/step2/page";
import Step3Page from "../pages/short-drama/step3/page";
import Step4Page from "../pages/short-drama/step4/page";
import OverviewPage from "../pages/short-drama/overview/page";
import ProjectsPage from "../pages/short-drama/projects/page";
import DemoPage from "../pages/short-drama/demo/page";
import AccountSettingsPage from "../pages/account/settings/page";
import BillingPage from "../pages/billing/page";
import BillingPlansPage from "../pages/billing/plans/page";
import BillingCheckoutPage from "../pages/billing/checkout/page";
import BillingSuccessPage from "../pages/billing/success/page";
import LoginPage from "../pages/auth/login/page";
import RegisterPage from "../pages/auth/register/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <ShortDramaLanding />,
  },
  {
    path: "/create",
    element: <CreateProjectPage />,
  },
  {
    path: "/step1",
    element: <Step1Page />,
  },
  {
    path: "/step2",
    element: <Step2Page />,
  },
  {
    path: "/step3",
    element: <Step3Page />,
  },
  {
    path: "/step4",
    element: <Step4Page />,
  },
  {
    path: "/overview",
    element: <OverviewPage />,
  },
  {
    path: "/projects",
    element: <ProjectsPage />,
  },
  {
    path: "/demo/:caseId",
    element: <DemoPage />,
  },
  {
    path: "/account/settings",
    element: <AccountSettingsPage />,
  },
  {
    path: "/billing",
    element: <BillingPage />,
  },
  {
    path: "/billing/plans",
    element: <BillingPlansPage />,
  },
  {
    path: "/billing/checkout",
    element: <BillingCheckoutPage />,
  },
  {
    path: "/billing/success",
    element: <BillingSuccessPage />,
  },
  {
    path: "/auth/login",
    element: <LoginPage />,
  },
  {
    path: "/auth/register",
    element: <RegisterPage />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;