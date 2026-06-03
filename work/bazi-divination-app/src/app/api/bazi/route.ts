import { NextResponse } from "next/server";
import { calculateBazi } from "@/lib/bazi";
import { getApproxLongitude } from "@/lib/location";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const province = searchParams.get("province") || "";
  const longitude = getApproxLongitude(province);
  const result = calculateBazi({
    year: searchParams.get("year") || "2000",
    month: searchParams.get("month") || "01",
    day: searchParams.get("day") || "01",
    hour: searchParams.get("hour") || "08",
    minute: searchParams.get("minute") || "00",
    gender: searchParams.get("gender") || "female",
    useTrueSolarTime: searchParams.get("timeMode") === "trueSolar",
    longitude,
  });

  return NextResponse.json(result);
}
