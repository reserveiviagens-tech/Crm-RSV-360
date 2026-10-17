import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Sparkles, X } from "lucide-react"
import { SuggestionCard } from "./SuggestionCard"
import { ComboIAEmptyState } from "./ComboIAEmptyState"
import { useComboRecommendations } from "@/hooks/useComboRecommendations"
import { trackEvent } from "@/lib/analytics"
import type { CartItem } from "@shared/schema"
import type { ComboCartItem, RecommendationSuggestion } from "@/services/recommendationApi"

type ComboIAWizardProps = {
  open: boolean
  onDismiss: () => void
  cartItems: CartItem[]
  onAddSuggestion: (suggestion: RecommendationSuggestion) => void
}

function cartItemsToInput(items: CartItem[]): ComboCartItem[] {
  return items.map((i) => ({
    ticketId: i.ticketId,
    name: i.name,
    unitPrice: i.unitPrice,
    originalPrice: i.originalPrice,
    discount: i.discount,
    quantity: i.quantity,
  }))
}

export function ComboIAWizard({ open, onDismiss, cartItems, onAddSuggestion }: ComboIAWizardProps) {
  const comboCartItems = cartItemsToInput(cartItems)

  const { suggestions, isLoading, isError } = useComboRecommendations({
    cartItems: comboCartItems,
    enabled: open && cartItems.length > 0,
  })

  const handleDismiss = (reason: "skip" | "close" | "backdrop") => {
    trackEvent("ai_combo_dismiss", { reason, suggestions: suggestions.length })
    onDismiss()
  }

  const handleAdd = (suggestion: RecommendationSuggestion) => {
    trackEvent("ai_combo_accept", {
      suggestionId: suggestion.id,
      comboPrice: suggestion.comboPrice,
      savings: suggestion.savings,
    })
    onAddSuggestion(suggestion)
    onDismiss()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss("backdrop")}>
      <DialogContent
        className="max-w-md w-full p-0 overflow-hidden rounded-2xl border-0 shadow-xl"
        data-testid="combo-ia-wizard"
      >
        <DialogHeader className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <DialogTitle className="text-white font-bold text-base">
                Sugestões Combo IA
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-8 w-8"
              onClick={() => handleDismiss("close")}
              data-testid="combo-ia-skip-btn"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-blue-100 text-xs mt-1">
            Economize mais adicionando estes ingressos ao seu pedido
          </p>
        </DialogHeader>

        <div className="px-5 py-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
          {isLoading && (
            <>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-blue-50 p-4 flex flex-col gap-2"
                  data-testid={`combo-ia-skeleton-${i}`}
                >
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex flex-col gap-1">
                      <Skeleton className="h-3 w-16 rounded" />
                      <Skeleton className="h-5 w-20 rounded" />
                    </div>
                    <Skeleton className="h-8 w-24 rounded-lg" />
                  </div>
                </div>
              ))}
            </>
          )}

          {!isLoading && isError && (
            <div
              className="flex flex-col items-center py-6 text-center text-sm text-muted-foreground"
              data-testid="combo-ia-error"
            >
              <p>Não foi possível carregar sugestões agora.</p>
              <p className="text-xs opacity-75 mt-1">Continue normalmente com sua compra.</p>
            </div>
          )}

          {!isLoading && !isError && suggestions.length === 0 && <ComboIAEmptyState />}

          {!isLoading && !isError && suggestions.length > 0 && (
            <>
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onAdd={handleAdd}
                />
              ))}
            </>
          )}
        </div>

        <div className="px-5 pb-4 pt-1 border-t border-gray-100">
          <Button
            variant="ghost"
            className="w-full text-sm text-gray-500 hover:text-gray-700"
            onClick={() => handleDismiss("skip")}
            data-testid="combo-ia-pular-btn"
          >
            Pular e continuar com meu carrinho
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
