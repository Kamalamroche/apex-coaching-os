import "@apex/ui/landing.css";
import "@apex/ui/site.css";
import type { ComponentType } from "react";
import { mount } from "../mount";
import { Landing } from "./Landing";
import { AboutPage, FeaturesPage, InActionPage, PricingPage, ResourcesPage, SolutionsPage } from "./site/Pages";

/* One bundle for the whole marketing site. Each page has its own index.html (for titles and sharing previews)
   and this picks the page from the path. Unknown paths fall back to the home page. */
const PAGES: Record<string, ComponentType> = {
  "/features/": FeaturesPage,
  "/solutions/": SolutionsPage,
  "/in-action/": InActionPage,
  "/resources/": ResourcesPage,
  "/pricing/": PricingPage,
  "/about/": AboutPage,
};

const path = location.pathname.endsWith("/") ? location.pathname : `${location.pathname}/`;
const Page = PAGES[path] ?? Landing;
mount(<Page />);
