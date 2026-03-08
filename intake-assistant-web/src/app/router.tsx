import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { AdvancedPage } from "@/pages/AdvancedPage";
import { IntakePage } from "@/pages/IntakePage";
import { ModeSelectorPage } from "@/pages/ModeSelectorPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <ModeSelectorPage />,
  },
  {
    path: "/intake",
    element: <IntakePage />,
  },
  {
    path: "/advanced",
    element: <AdvancedPage />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
