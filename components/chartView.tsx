"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type SpotPrice = {
  DateTime?: string | null
  PriceNoTax?: number | null
  PriceWithTax?: number | null
  Rank?: number | null
}

type ChartDatum = {
  label: string
  fullLabel: string
  price: number
  timestamp: number
  dayKey: string
  fill?: string
}

type ChartViewProps = {
  data: SpotPrice[]
  title?: string
  description?: string
  unit?: string
  useTax?: boolean
  valueMultiplier?: number
  showPast?: boolean
  className?: string
}

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
})
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
const weekdayFormatter = new Intl.DateTimeFormat("fi-FI", {
  weekday: "long",
})
const weekdayShortFormatter = new Intl.DateTimeFormat("fi-FI", {
  weekday: "short",
})
const tooltipTimeFormatter = new Intl.DateTimeFormat("fi-FI", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
})

function hourTickFormatter(value: number) {
  if (typeof value !== "number") return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const hour = date.getHours()
  return String(hour)
}

const PRICE_COLORS = {
  low: "#16a34a",
  mid: "#f59e0b",
  high: "#ef4444",
}

const tickStyle = {
  fill: "var(--muted-foreground)",
  fontSize: "0.875rem",
}

function formatDayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatTooltipLabel(date: Date) {
  const weekday = weekdayFormatter.format(date)
  const capitalized =
    weekday.length > 0 ? `${weekday[0].toUpperCase()}${weekday.slice(1)}` : ""
  const day = date.getDate()
  const month = date.getMonth() + 1
  const time = tooltipTimeFormatter.format(date)
  return `${capitalized} ${day}.${month} ${time}`
}

function formatDayLineLabel(date: Date) {
  const weekday = weekdayShortFormatter.format(date)
  const capitalized =
    weekday.length > 0 ? `${weekday[0].toUpperCase()}${weekday.slice(1)}` : ""
  const day = date.getDate()
  const month = date.getMonth() + 1
  return `${capitalized} ${day}.${month}`
}

export default function ChartView({
  data,
  unit = "EUR/kWh",
  useTax = true,
  valueMultiplier = 1,
  showPast = false,
  className,
}: ChartViewProps) {
  const chartData = React.useMemo<ChartDatum[]>(() => {
    return (data ?? [])
      .map((item) => {
        if (!item?.DateTime) return null
        const rawPrice = useTax ? item.PriceWithTax : item.PriceNoTax
        if (rawPrice == null) return null
        const price = rawPrice * valueMultiplier
        const date = new Date(item.DateTime)
        if (Number.isNaN(date.getTime())) return null
        return {
          label: timeFormatter.format(date),
          fullLabel: formatTooltipLabel(date),
          price,
          timestamp: date.getTime(),
          dayKey: formatDayKey(date),
        }
      })
      .filter((item): item is ChartDatum => Boolean(item))
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [data, useTax, valueMultiplier])

  const stepMinutes = React.useMemo(() => {
    if (chartData.length < 2) return 60
    const diffs = chartData
      .slice(1)
      .map((item, index) => item.timestamp - chartData[index].timestamp)
      .filter((diff) => diff > 0)
    if (!diffs.length) return 60
    diffs.sort((a, b) => a - b)
    const median = diffs[Math.floor(diffs.length / 2)]
    const minutes = Math.round(median / 60000)
    return minutes || 60
  }, [chartData])

  const pointsPerHour = React.useMemo(
    () => Math.max(1, Math.round(60 / stepMinutes)),
    [stepMinutes]
  )

  const coloredData = React.useMemo(() => {
    if (!chartData.length) return []

    const grouped = new Map<string, ChartDatum[]>()
    chartData.forEach((point) => {
      const bucket = grouped.get(point.dayKey) ?? []
      bucket.push(point)
      grouped.set(point.dayKey, bucket)
    })

    const dayMeta = new Map<
      string,
      { ranks: Map<number, number>; greenLimit: number; yellowLimit: number }
    >()

    grouped.forEach((points, dayKey) => {
      const sorted = [...points].sort((a, b) => a.price - b.price)
      const ranks = new Map<number, number>()
      sorted.forEach((point, index) => {
        ranks.set(point.timestamp, index)
      })
      const greenLimit = Math.min(points.length, 6 * pointsPerHour)
      const yellowLimit = Math.min(points.length, 12 * pointsPerHour)
      dayMeta.set(dayKey, { ranks, greenLimit, yellowLimit })
    })

    const colored = chartData.map((point) => {
      const meta = dayMeta.get(point.dayKey)
      const rank = meta?.ranks.get(point.timestamp) ?? 0
      const fill =
        rank < (meta?.greenLimit ?? 0)
          ? PRICE_COLORS.low
          : rank < (meta?.yellowLimit ?? 0)
          ? PRICE_COLORS.mid
          : PRICE_COLORS.high
      return { ...point, fill }
    })

    return colored
  }, [chartData, pointsPerHour])

  const stepMs = stepMinutes * 60 * 1000
  const nowTimestamp = Date.now()

  const visibleData = React.useMemo(() => {
    if (showPast) return coloredData
    const now = Date.now()
    return coloredData.filter((entry) => now < entry.timestamp + stepMs)
  }, [coloredData, showPast, stepMs])

  const axisTicks = React.useMemo(() => {
    if (!visibleData.length) return undefined
    const start = new Date(visibleData[0].timestamp)
    const end = new Date(visibleData[visibleData.length - 1].timestamp)
    const tick = new Date(start)
    tick.setMinutes(0, 0, 0)
    if (tick.getTime() < start.getTime()) {
      tick.setHours(tick.getHours() + 1)
    }
    if (tick.getHours() % 2 !== 0) {
      tick.setHours(tick.getHours() + 1)
    }
    const ticks: number[] = []
    while (tick.getTime() <= end.getTime()) {
      ticks.push(tick.getTime())
      tick.setHours(tick.getHours() + 2)
    }
    return ticks
  }, [visibleData])

  const dayChangeMarkers = React.useMemo(() => {
    if (!visibleData.length) return []
    const halfStepMs = stepMs / 2
    const markers: Array<{ x: number; label: string }> = []
    let lastDay = visibleData[0].dayKey
    for (let i = 1; i < visibleData.length; i += 1) {
      if (visibleData[i].dayKey !== lastDay) {
        const boundaryTimestamp = visibleData[i].timestamp
        markers.push({
          x: boundaryTimestamp - halfStepMs,
          label: formatDayLineLabel(new Date(boundaryTimestamp)),
        })
        lastDay = visibleData[i].dayKey
      }
    }
    return markers
  }, [visibleData, stepMs])

  const nowLineTimestamp = React.useMemo(() => {
    if (!visibleData.length) return null
    const now = Date.now()
    const min = visibleData[0].timestamp
    const max = visibleData[visibleData.length - 1].timestamp
    if (now < min || now > max) return null
    return now
  }, [visibleData])

  const stats = React.useMemo(() => {
    if (!visibleData.length) return null
    const values = visibleData.map((point) => point.price)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length
    return { min, max, avg }
  }, [visibleData])

  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState<number | null>(
    null
  )

  React.useEffect(() => {
    const node = containerRef.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setContainerWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const barSize = React.useMemo(() => {
    if (!containerWidth || !visibleData.length) return undefined
    const available = Math.max(0, containerWidth - 16)
    const perBar = available / visibleData.length
    return Math.max(1, Math.floor(perBar * 0.92))
  }, [containerWidth, visibleData.length])

  const xDomain = React.useMemo(
    (): [(min: number) => number, (max: number) => number] => {
      const padding = stepMs / 2
      return [
        (min: number) => min - padding,
        (max: number) => max + padding,
      ]
    },
    [stepMs]
  )

  const chartConfig = React.useMemo<ChartConfig>(
    () => ({
      price: {
        label: unit ? `Price (${unit})` : "Price",
        color: "var(--chart-1)",
      },
    }),
    [unit]
  )

  return (
    <Card className={cn("border-border/60", className)}>
      <CardHeader className="gap-4">
        {stats ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Minimi</div>
              <div className="text-lg font-semibold">
                {numberFormatter.format(stats.min)} snt
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Keskiarvo</div>
              <div className="text-lg font-semibold">
                {numberFormatter.format(stats.avg)} snt
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Maksimi</div>
              <div className="text-lg font-semibold">
                {numberFormatter.format(stats.max)} snt
              </div>
            </div>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {visibleData.length ? (
          <div ref={containerRef} className="h-[320px] w-full">
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-full w-full"
            >
              <BarChart
                data={visibleData}
                margin={{ left: 8, right: 8, top: 12 }}
                barCategoryGap={0}
                barGap={0}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                {dayChangeMarkers.map((marker) => (
                  <ReferenceLine
                    key={`day-${marker.x}`}
                    x={marker.x}
                    stroke="#9ca3af"
                    label={{
                      value: marker.label,
                      position: "top",
                      fill: "#9ca3af",
                      fontSize: 10,
                    }}
                  />
                ))}
                {nowLineTimestamp != null ? (
                  <ReferenceLine
                    x={nowLineTimestamp}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{
                      value: "NOW",
                      position: "top",
                      fill: "#94a3b8",
                      fontSize: 10,
                    }}
                  />
                ) : null}
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={xDomain}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tickFormatter={hourTickFormatter}
                  ticks={axisTicks}
                  tick={tickStyle}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(value) =>
                    typeof value === "number"
                      ? numberFormatter.format(value)
                      : ""
                  }
                  tick={tickStyle}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      hideIndicator
                      formatter={(value, _name, item) => {
                        const point = item?.payload as ChartDatum | undefined
                        const formatted =
                          typeof value === "number"
                            ? numberFormatter.format(value)
                            : ""
                        return (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              {point?.fullLabel ?? ""}
                            </span>
                            <span className="text-foreground font-mono font-medium tabular-nums">
                              {formatted}
                              {unit ? ` ${unit}` : ""}
                            </span>
                          </div>
                        )
                      }}
                    />
                  }
                />
                <Bar dataKey="price" radius={[6, 6, 0, 0]} barSize={barSize}>
                  {visibleData.map((entry) => {
                    const isPast =
                      showPast && nowTimestamp >= entry.timestamp + stepMs
                    return (
                      <Cell
                        key={`cell-${entry.timestamp}`}
                        fill={entry.fill}
                        fillOpacity={isPast ? 0.45 : 1}
                      />
                    )
                  })}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        ) : (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            Ei saatavilla
          </div>
        )}
      </CardContent>
    </Card>
  )
}
