"use client"

import * as React from "react"
import { BarChart3 } from "lucide-react"
import Link from "next/link"

import ChartView from "@/components/chartView"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

type SpotPrice = {
  DateTime?: string | null
  PriceNoTax?: number | null
  PriceWithTax?: number | null
  Rank?: number | null
}

const REGION_OPTIONS = [
  "FI",
  "SE1",
  "SE2",
  "SE3",
  "SE4",
  "NO1",
  "NO2",
  "NO3",
  "NO4",
  "NO5",
  "DK1",
  "DK2",
  "EE",
  "LT",
  "LV",
]

const RESOLUTION_OPTIONS = [
  { value: "15", label: "Varttitunti" },
  { value: "60", label: "Tunti" },
]

const TAX_OPTIONS = [
  { value: "withTax", label: "ALV" },
  { value: "withoutTax", label: "Ei ALV:ia" },
]

type OptionButtonProps = {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

function OptionButton({
  active,
  disabled,
  onClick,
  children,
}: OptionButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      variant={active ? "default" : "outline"}
      className=" w-full text-base"
    >
      {children}
    </Button>
  )
}

function buildSpotQuery({
  region,
  priceResolution,
}: {
  region: string
  priceResolution: string
}) {
  const params = new URLSearchParams()
  params.set("region", region)
  params.set("priceResolution", priceResolution)
  return params.toString()
}

function normalizePayload(payload: unknown): SpotPrice[] {
  if (Array.isArray(payload)) {
    return payload as SpotPrice[]
  }
  if (payload && typeof payload === "object" && "DateTime" in payload) {
    return [payload as SpotPrice]
  }
  return []
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const errorValue = (payload as { error?: string }).error
    if (typeof errorValue === "string" && errorValue.trim()) {
      return errorValue
    }
  }
  if (typeof payload === "string" && payload.trim()) {
    return payload
  }
  return fallback
}

export default function Home() {
  const [region, setRegion] = React.useState("FI")
  const [priceResolution, setPriceResolution] = React.useState("60")
  const [taxMode, setTaxMode] = React.useState("withTax")
  const [showPast, setShowPast] = React.useState(false)
  const [data, setData] = React.useState<SpotPrice[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const baseQuery = React.useMemo(
    () => buildSpotQuery({ region, priceResolution }),
    [region, priceResolution]
  )

  const loadPrices = React.useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true)
      setError(null)
      try {
        const fetchSpot = async (type: "todayAndDayForward" | "today") => {
          const response = await fetch(
            `/api/spot?type=${type}&${baseQuery}`,
            { signal }
          )
          const isJson = response.headers
            .get("content-type")
            ?.includes("application/json")
          const payload = isJson ? await response.json() : await response.text()
          return { response, payload }
        }

        const primary = await fetchSpot("todayAndDayForward")
        if (primary.response.ok) {
          setData(normalizePayload(primary.payload))
          return
        }

        if (primary.response.status === 404) {
          const fallback = await fetchSpot("today")
          if (!fallback.response.ok) {
            setError(
              getErrorMessage(
                fallback.payload,
                fallback.response.statusText
              )
            )
            setData([])
            return
          }
          setData(normalizePayload(fallback.payload))
          return
        }

        setError(
          getErrorMessage(primary.payload, primary.response.statusText)
        )
        setData([])
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return
        }
        setError("Failed to load prices.")
        setData([])
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false)
        }
      }
    },
    [baseQuery]
  )

  React.useEffect(() => {
    const controller = new AbortController()
    void loadPrices(controller.signal)
    return () => controller.abort()
  }, [loadPrices])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
      <header className="flex items-start gap-4">
        <div className="text-primary flex items-center justify-center rounded-xl">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h1>Pörssisähkön hinta</h1>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Alue</label>
          <div className="mt-2">
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="h-12 w-full text-base">
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                {REGION_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Tyyppi</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {RESOLUTION_OPTIONS.map((option) => (
              <OptionButton
                key={option.value}
                active={priceResolution === option.value}
                onClick={() => setPriceResolution(option.value)}
              >
                {option.label}
              </OptionButton>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Tax mode</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {TAX_OPTIONS.map((option) => (
              <OptionButton
                key={option.value}
                active={taxMode === option.value}
                onClick={() => setTaxMode(option.value)}
              >
                {option.label}
              </OptionButton>
            ))}
          </div>
        </div>
        <div>
          <label
            htmlFor="show-past"
            className="flex cursor-pointer items-center gap-3 text-base font-medium"
          >
            <Checkbox
              id="show-past"
              className="h-5 w-5"
              checked={showPast}
              onCheckedChange={(checked) => setShowPast(checked === true)}
            />
            Näytä menneisyys
          </label>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {isLoading ? (
          <span className="text-muted-foreground">Ladataan hintoja...</span>
        ) : null}
        {error ? <span className="text-destructive">{error}</span> : null}
      </div>

      <ChartView
        data={data}
        useTax={taxMode === "withTax"}
        unit="c/kWh"
        valueMultiplier={100}
        showPast={showPast}
      />
      <footer className="text-center flex gap-2 items-center justify-center text-sm text-muted-foreground">
        <p className="">Palvelun tarjoaa <Link href="https://eino-it.fi" target="_blank" className="text-primary">Eino IT</Link></p>
        <span className="text-muted-foreground">|</span>
        <p className="">Käytetty rajapinta: <Link href="https://spot-hinta.fi" target="_blank" className="text-primary">spot-hinta.fi</Link></p>
        <span className="text-muted-foreground">|</span>
        <p>Lähdekoodi: <Link href="https://github.com/eino-it/spot-hinta" target="_blank" className="text-primary">github.com/eino-it/spot-hinta</Link></p>
      </footer>
    </div>
  )
}
