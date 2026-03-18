import { Suspense } from "react";
import { AppView } from "~views/app-view";

export default function AppPage() {
  return (
    <Suspense>
      <AppView />
    </Suspense>
  );
}
