import { useLocalSearchParams } from "expo-router";

import { ReaderScreen } from "~/features/library/screens/reader-screen";

export default function ReaderRoute() {
  const {
    annotationId,
    id,
    location,
    occurrence,
    page,
    query,
    scope,
    sectionId,
  } = useLocalSearchParams<{
    annotationId?: string;
    id: string;
    location?: string;
    occurrence?: string;
    page?: string;
    query?: string;
    scope?: "import" | "library";
    sectionId?: string;
  }>();
  return (
    <ReaderScreen
      destination={{
        annotationId,
        location: numberParam(location),
        occurrence: numberParam(occurrence),
        page: numberParam(page),
        query,
        sectionId,
      }}
      id={id}
      scope={scope ?? "library"}
    />
  );
}

function numberParam(value: string | undefined) {
  if (!value) return undefined;
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : undefined;
}
