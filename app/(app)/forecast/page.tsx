import { getForecastPageDataAction } from "@/app/actions/forecast-actions";
import { ForecastClient } from "./ForecastClient";

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function ForecastPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const year = params.year ? parseInt(params.year) : new Date().getFullYear();

  const result = await getForecastPageDataAction(year);

  if (!result.data) {
    return null;
  }

  return <ForecastClient data={result.data} />;
}
