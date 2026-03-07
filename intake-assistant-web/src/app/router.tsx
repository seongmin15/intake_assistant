import { createBrowserRouter, RouterProvider } from "react-router-dom";

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
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
