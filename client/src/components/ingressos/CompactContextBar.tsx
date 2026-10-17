import { useState } from "react"
import { Calendar, CloudSun, MapPin } from "lucide-react"
import { CalendarioIngressos } from "@/components/CalendarioIngressos"
import type { DestinationCity } from "@/lib/enterprises"

interface CompactContextBarProps {
  selectedDate: Date | null
  onDateSelect: (date: Date) => void
  selectedCity?: DestinationCity
  onCityChange?: (city: DestinationCity) => void
  weatherLabel?: string
}

export function CompactContextBar({
  selectedDate,
  onDateSelect,
  selectedCity = "multi-destino",
  onCityChange,
  weatherLabel = "Rio Quente · 24°C (Parcialmente nublado)",
}: CompactContextBarProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  const dateLabel = selectedDate
    ? `Data: ${selectedDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
    : "Escolher data da visita ▾"

  return (
    <div
      data-testid="compact-context-bar"
      className="w-full bg-slate-900 text-white rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-4 shadow-lg border border-slate-800"
      style={{ minHeight: 56 }}
    >
      <div className="flex items-center gap-2 text-sm">
        <MapPin size={16} className="text-blue-400 shrink-0" />
        <span className="text-slate-300 text-xs uppercase tracking-wider font-semibold">Destino:</span>
        <select
          data-testid="select-destino-context"
          value={selectedCity}
          onChange={(e) => onCityChange?.(e.target.value as DestinationCity)}
          className="rsv-select-control bg-slate-800 text-white border border-slate-700 rounded-lg text-xs focus:outline-none focus:border-blue-500"
        >
          <option value="multi-destino">Caldas Novas & Rio Quente</option>
          <option value="rio-quente">Rio Quente</option>
          <option value="caldas-novas">Caldas Novas</option>
        </select>
      </div>

      <div className="relative">
        <button
          type="button"
          data-testid="btn-data-visita"
          onClick={() => setIsCalendarOpen((o) => !o)}
          className="rsv-hit-44-inline flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors shadow-sm"
        >
          <Calendar size={15} />
          <span>{dateLabel}</span>
        </button>

        {isCalendarOpen && (
          <div className="absolute right-0 mt-2 z-50 bg-white text-slate-900 p-4 rounded-xl shadow-2xl border border-slate-200 w-80 sm:w-96">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700">Selecione o dia da visita</span>
              <button
                type="button"
                data-testid="btn-fechar-calendario"
                onClick={() => setIsCalendarOpen(false)}
                className="rsv-hit-44-inline text-slate-400 hover:text-slate-600 text-xs font-bold px-3 rounded"
              >
                Fechar
              </button>
            </div>
            <CalendarioIngressos
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                onDateSelect(date)
                setIsCalendarOpen(false)
              }}
            />
          </div>
        )}
      </div>

      <div
        data-testid="pill-clima"
        className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs text-slate-200"
      >
        <CloudSun size={15} className="text-amber-400 shrink-0" />
        <span>{weatherLabel}</span>
      </div>
    </div>
  )
}
