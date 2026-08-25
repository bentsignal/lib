import { useLocalSearchParams } from "expo-router";

import { BookOverviewScreen } from "~/features/library/screens/book-overview-screen";

export default function BookOverviewRoute() {
  const { id, scope } = useLocalSearchParams<{
    id: string;
    scope?: "import" | "library";
  }>();
  return <BookOverviewScreen id={id} scope={scope ?? "library"} />;
}
