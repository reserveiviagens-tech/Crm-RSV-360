import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProtectedRoute from "@/components/protected-route";
import { ScrollToTop } from "@/components/scroll-to-top";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import LandingPage from "@/pages/landing";
import Hoteis from "@/pages/hoteis";
import Promocoes from "@/pages/promocoes";
import FlashDeals from "@/pages/flash-deals";
import Leiloes from "@/pages/leiloes";
import Ingressos from "@/pages/ingressos";
import IngressosCheckout from "@/pages/ingressos-checkout";
import IngressosSucesso from "@/pages/ingressos-sucesso";
import Atracoes from "@/pages/atracoes";
import Parques from "@/pages/parques"
import CombosAcesse from "@/pages/combosacesse";
import Contato from "@/pages/contato";
import CaldasAI from "@/pages/caldas-ai";
import MapaCaldas from "@/pages/mapa-caldas-novas";
import Perfil from "@/pages/perfil";
import ViagensGrupo from "@/pages/viagens-grupo";
import CriarExcursao from "@/pages/criar-excursao";
import QuemSomos from "@/pages/quem-somos";
import PoliticaPrivacidade from "@/pages/politica-de-privacidade";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminFnrh from "@/pages/admin/fnrh";
import AssinaturaDigital from "@/pages/admin/assinatura-digital";
import Financeiro from "@/pages/admin/financeiro";
import Integracoes from "@/pages/admin/integracoes";
import CadasturPage from "@/pages/admin/cadastur";
import LGPDDashboard from "@/pages/admin/lgpd";
import RelatoriosAds from "@/pages/admin/relatorios-ads";
import SeguroViagem from "@/pages/admin/seguro-viagem";
import SegurancaEmbarque from "@/pages/admin/seguranca-embarque";
import ContratosExcursao from "@/pages/admin/contratos";
import FrotaANTT from "@/pages/admin/frota-antt";
import Excursoes from "@/pages/excursoes";
import CircularNav from "@/components/circular-nav";
import CaldasAiFloatingAgent from "@/components/caldas-ai-floating-agent";
import KYCVerificacao from "@/pages/kyc-verificacao";
import WaaSDashboard from "@/pages/admin/waas-dashboard";
import GamificationDashboard from "@/pages/organizer/gamification-dashboard";
import MinhaJornada from "@/pages/minha-jornada";
import RankingOrganizadores from "@/pages/ranking-organizadores";
import ExcursaoLanding from "@/pages/excursao-landing";
import FinancialDashboard from "@/pages/superadmin/financial-dashboard";
import LiveChat from "@/pages/superadmin/live-chat";
import Entrar from "@/pages/entrar";
import Cadastrar from "@/pages/cadastrar";
import CatalogoExcursoes from "@/pages/catalogo-excursoes";
import MinhasReservas from "@/pages/minhas-reservas";
import Notificacoes from "@/pages/notificacoes";
import Configuracoes from "@/pages/configuracoes";
import ProgramaFidelidade from "@/pages/programa-fidelidade";
import MinhasAvaliacoes from "@/pages/minhas-avaliacoes";
import AdminNovaReserva from "@/pages/admin/nova-reserva";
import AdminClientes from "@/pages/admin/clientes";
import AdminCRM from "@/pages/admin/crm";
import AdminRelatorioMensal from "@/pages/admin/relatorio-mensal";
import AdminConfiguracoesSistema from "@/pages/admin/configuracoes-sistema";
import AdminBranding from "@/pages/admin/branding";
import AdminMapa from "@/pages/admin/mapa";
import AdminPermissoes from "@/pages/admin/permissoes";
import AdminLeiloes from "@/pages/admin/leiloes";
import Pagamentos from "@/pages/pagamentos";
import Suporte from "@/pages/suporte";
import SearchPage from "@/pages/SearchPage";
import OrderStatusPage from "@/pages/public/order-status";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/busca" component={SearchPage} />
      <Route path="/pagamentos" component={Pagamentos} />
      <Route path="/suporte" component={Suporte} />
      <Route path="/home" component={Home} />
      <Route path="/hoteis" component={Hoteis} />
      <Route path="/hoteis/:id" component={Hoteis} />
      <Route path="/excursoes" component={Excursoes} />
      <Route path="/catalogo-excursoes" component={CatalogoExcursoes} />
      <Route path="/promocoes" component={Promocoes} />
      <Route path="/flash-deals" component={FlashDeals} />
      <Route path="/leiloes" component={Leiloes} />
      <Route path="/ingressos" component={Ingressos} />
      <Route path="/ingressos/checkout" component={IngressosCheckout} />
      <Route path="/ingressos/sucesso" component={IngressosSucesso} />
      <Route path="/pedido/:id" component={OrderStatusPage} />
      <Route path="/parques" component={Parques} />
      <Route path="/combos" component={CombosAcesse} />
      <Route path="/combosacesse" component={CombosAcesse} />
      <Route path="/atracoes" component={Atracoes} />
      <Route path="/contato" component={Contato} />
      <Route path="/caldas-ai" component={CaldasAI} />
      <Route path="/mapa-caldas-novas" component={MapaCaldas} />
      <Route path="/mapa" component={MapaCaldas} />
      <Route path="/perfil" component={Perfil} />
      <Route path="/minhas-reservas" component={MinhasReservas} />
      <Route path="/notificacoes" component={Notificacoes} />
      <Route path="/configuracoes" component={Configuracoes} />
      <Route path="/programa-fidelidade" component={ProgramaFidelidade} />
      <Route path="/minhas-avaliacoes" component={MinhasAvaliacoes} />
      <Route path="/viagens-grupo" component={ViagensGrupo} />
      <Route path="/viagens-grupo/:id" component={ViagensGrupo} />
      <Route path="/criar-excursao">{() => <ProtectedRoute roles={["LIDER", "admin"]} unauthorizedRedirect="/perfil"><CriarExcursao /></ProtectedRoute>}</Route>
      <Route path="/criar-excursao/:id">{() => <ProtectedRoute roles={["LIDER", "admin"]} unauthorizedRedirect="/perfil"><CriarExcursao /></ProtectedRoute>}</Route>
      <Route path="/quem-somos" component={QuemSomos} />
      <Route path="/politica-de-privacidade" component={PoliticaPrivacidade} />
      <Route path="/admin">{() => <ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>}</Route>
      <Route path="/admin/dashboard">{() => <ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>}</Route>
      <Route path="/admin/fnrh">{() => <ProtectedRoute roles={["admin"]}><AdminFnrh /></ProtectedRoute>}</Route>
      <Route path="/admin/assinatura-digital">{() => <ProtectedRoute roles={["admin"]}><AssinaturaDigital /></ProtectedRoute>}</Route>
      <Route path="/admin/financeiro">{() => <ProtectedRoute roles={["admin"]}><Financeiro /></ProtectedRoute>}</Route>
      <Route path="/admin/integracoes">{() => <ProtectedRoute roles={["admin"]}><Integracoes /></ProtectedRoute>}</Route>
      <Route path="/admin/cadastur">{() => <ProtectedRoute roles={["admin"]}><CadasturPage /></ProtectedRoute>}</Route>
      <Route path="/admin/lgpd">{() => <ProtectedRoute roles={["admin"]}><LGPDDashboard /></ProtectedRoute>}</Route>
      <Route path="/admin/relatorios-ads">{() => <ProtectedRoute roles={["admin"]}><RelatoriosAds /></ProtectedRoute>}</Route>
      <Route path="/admin/seguro-viagem">{() => <ProtectedRoute roles={["admin"]}><SeguroViagem /></ProtectedRoute>}</Route>
      <Route path="/admin/seguranca-embarque">{() => <ProtectedRoute roles={["admin"]}><SegurancaEmbarque /></ProtectedRoute>}</Route>
      <Route path="/admin/contratos">{() => <ProtectedRoute roles={["admin"]}><ContratosExcursao /></ProtectedRoute>}</Route>
      <Route path="/admin/frota-antt">{() => <ProtectedRoute roles={["admin"]}><FrotaANTT /></ProtectedRoute>}</Route>
      <Route path="/admin/frota">{() => <ProtectedRoute roles={["admin"]}><FrotaANTT /></ProtectedRoute>}</Route>
      <Route path="/admin/nova-reserva">{() => <ProtectedRoute roles={["admin"]}><AdminNovaReserva /></ProtectedRoute>}</Route>
      <Route path="/admin/clientes">{() => <ProtectedRoute roles={["admin"]}><AdminClientes /></ProtectedRoute>}</Route>
      <Route path="/admin/crm">{() => <ProtectedRoute roles={["admin"]}><AdminCRM /></ProtectedRoute>}</Route>
      <Route path="/admin/relatorio-mensal">{() => <ProtectedRoute roles={["admin"]}><AdminRelatorioMensal /></ProtectedRoute>}</Route>
      <Route path="/admin/configuracoes-sistema">{() => <ProtectedRoute roles={["admin"]}><AdminConfiguracoesSistema /></ProtectedRoute>}</Route>
      <Route path="/admin/branding">{() => <ProtectedRoute roles={["admin"]}><AdminBranding /></ProtectedRoute>}</Route>
      <Route path="/admin/mapa">{() => <ProtectedRoute roles={["admin"]}><AdminMapa /></ProtectedRoute>}</Route>
      <Route path="/admin/permissoes">{() => <ProtectedRoute roles={["admin"]}><AdminPermissoes /></ProtectedRoute>}</Route>
      <Route path="/admin/leiloes">{() => <ProtectedRoute roles={["admin"]}><AdminLeiloes /></ProtectedRoute>}</Route>
      <Route path="/admin/excursoes">{() => <ProtectedRoute roles={["admin"]}><ViagensGrupo /></ProtectedRoute>}</Route>
      <Route path="/admin/passageiros">{() => <ProtectedRoute roles={["admin"]}><ViagensGrupo /></ProtectedRoute>}</Route>
      <Route path="/dashboard">{() => <ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>}</Route>
      <Route path="/entrar" component={Entrar} />
      <Route path="/login" component={Entrar} />
      <Route path="/cadastrar" component={Cadastrar} />
      <Route path="/kyc" component={KYCVerificacao} />
      <Route path="/admin/waas">{() => <ProtectedRoute roles={["admin"]}><WaaSDashboard /></ProtectedRoute>}</Route>
      <Route path="/waas">{() => <ProtectedRoute roles={["admin"]}><WaaSDashboard /></ProtectedRoute>}</Route>
      <Route path="/organizer/metas">{() => <ProtectedRoute roles={["LIDER", "admin"]}><GamificationDashboard /></ProtectedRoute>}</Route>
      <Route path="/metas">{() => <ProtectedRoute roles={["LIDER", "admin"]}><GamificationDashboard /></ProtectedRoute>}</Route>
      <Route path="/minha-jornada" component={MinhaJornada} />
      <Route path="/ranking-organizadores" component={RankingOrganizadores} />
      <Route path="/admin/super-financeiro">{() => <ProtectedRoute roles={["admin"]}><FinancialDashboard /></ProtectedRoute>}</Route>
      <Route path="/super-financeiro">{() => <ProtectedRoute roles={["admin"]}><FinancialDashboard /></ProtectedRoute>}</Route>
      <Route path="/admin/live-chat">{() => <ProtectedRoute roles={["admin"]}><LiveChat /></ProtectedRoute>}</Route>
      <Route path="/live-chat">{() => <ProtectedRoute roles={["admin"]}><LiveChat /></ProtectedRoute>}</Route>
      <Route path="/excursoes/:slug" component={ExcursaoLanding} />
      <Route component={NotFound} />
    </Switch>
  );
}

const CALDAS_AI_EXCLUDED_ROUTES = [
  "/admin",
  "/dashboard",
  "/ingressos/checkout",
  "/ingressos/sucesso",
  "/waas",
  "/live-chat",
  "/super-financeiro",
  "/organizer",
  "/metas",
]

function AppContent() {
  const [location] = useLocation()
  const showCaldasAi = !CALDAS_AI_EXCLUDED_ROUTES.some(r => location.startsWith(r))

  return (
    <>
      <ScrollToTop />
      <Router />
      <CircularNav />
      {showCaldasAi && <CaldasAiFloatingAgent />}
    </>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
