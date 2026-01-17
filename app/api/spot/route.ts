import { NextResponse } from "next/server"

const BASE_URL = "https://api.spot-hinta.fi"
const CACHE_SECONDS = 60

const ENDPOINTS = {
  today: "/Today",
  dayForward: "/DayForward",
  todayAndDayForward: "/TodayAndDayForward",
  justNow: "/JustNow",
} as const

type EndpointKey = keyof typeof ENDPOINTS

const TYPE_ALIASES: Record<string, EndpointKey> = {
  today: "today",
  dayforward: "dayForward",
  "day-forward": "dayForward",
  tomorrow: "dayForward",
  todayanddayforward: "todayAndDayForward",
  "today-dayforward": "todayAndDayForward",
  "today-and-dayforward": "todayAndDayForward",
  justnow: "justNow",
  "just-now": "justNow",
  now: "justNow",
}

function resolveType(value: string | null): EndpointKey | null {
  if (!value) return "today"
  return TYPE_ALIASES[value.toLowerCase()] ?? null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = resolveType(searchParams.get("type"))

  if (!type) {
    return NextResponse.json(
      {
        error:
          "Invalid type. Use: today, dayForward, todayAndDayForward, justNow.",
      },
      { status: 400 }
    )
  }

  const upstreamUrl = new URL(ENDPOINTS[type], BASE_URL)
  const upstreamParams = new URLSearchParams()

  const region = searchParams.get("region")
  if (region) {
    upstreamParams.set("region", region.toUpperCase())
  }

  const priceResolution = searchParams.get("priceResolution")
  if (priceResolution) {
    const parsed = Number(priceResolution)
    if (![15, 60].includes(parsed)) {
      return NextResponse.json(
        { error: "priceResolution must be 15 or 60." },
        { status: 400 }
      )
    }
    upstreamParams.set("priceResolution", String(parsed))
  }

  const lookForwardHours = searchParams.get("lookForwardHours")
  if (lookForwardHours) {
    const parsed = Number(lookForwardHours)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 6) {
      return NextResponse.json(
        { error: "lookForwardHours must be an integer between 1 and 6." },
        { status: 400 }
      )
    }
    upstreamParams.set("lookForwardHours", String(parsed))
  }

  const homeAssistant = searchParams.get("HomeAssistant")
  if (homeAssistant === "true" || homeAssistant === "false") {
    upstreamParams.set("HomeAssistant", homeAssistant)
  }

  const homeAssistant15 = searchParams.get("HomeAssistant15Min")
  if (homeAssistant15 === "true" || homeAssistant15 === "false") {
    upstreamParams.set("HomeAssistant15Min", homeAssistant15)
  }

  if ([...upstreamParams.keys()].length) {
    upstreamUrl.search = upstreamParams.toString()
  }

  try {
    const response = await fetch(upstreamUrl.toString(), {
      next: { revalidate: CACHE_SECONDS },
    })
    const contentType =
      response.headers.get("content-type") ?? "application/json"
    const body = await response.text()
    const headers = new Headers({ "content-type": contentType })

    if (response.ok) {
      headers.set(
        "Cache-Control",
        `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=300`
      )
    }

    return new NextResponse(body, {
      status: response.status,
      headers,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Upstream request failed." },
      { status: 502 }
    )
  }
}
