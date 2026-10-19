"use client";
import { useEffect, useState, useRef } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  CheckCheck,
  Settings,
  ChevronRight,
  Plus,
  ArrowUpRight,
  Wallet,
  TrendingUp,
  Layers,
  Send,
  Sun,
  Moon,
  LogOut,
  Download,
  Copy,
  ShieldCheck,
  Menu,
  AlertTriangle,
  Check,
  Leaf,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { FinancialDecimal as Decimal } from "@/lib/finance";
import { Importer } from "@/components/importer";
import { Button } from "@/components/ui/button";
import { interpreter, operationSchema, OperationInput } from "@/lib/parser";
import {
  positions,
  monthlyResults,
  realizedInPeriod,
  money,
  Trade,
} from "@/lib/finance";
type Op = Trade & {
  id: string;
  broker: string;
  assetClass: string;
  modality: string;
};
const sections = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Operações", icon: ArrowLeftRight },
  { name: "Imposto de Renda", icon: FileText },
  { name: "Conciliação", icon: CheckCheck },
  { name: "Configurações", icon: Settings },
];
const brl = (v: string) => `R$ ${money(v)}`;
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const empty: OperationInput = {
  ticker: "",
  quantity: "",
  price: "",
  fees: "0",
  side: "BUY",
  date: today(),
  assetClass: "ACAO",
  modality: "COMUM",
  broker: "",
};
export default function Home() {
  const [page, setPage] = useState("Dashboard"),
    [user, setUser] = useState<{
      name: string;
      email: string;
      audit: { action: string; entityId: string; createdAt: string }[];
    } | null>(null),
    [auth, setAuth] = useState(false),
    [loadError, setLoadError] = useState(""),
    [register, setRegister] = useState(false),
    [ops, setOps] = useState<Op[]>([]),
    [notice, setNotice] = useState(""),
    [message, setMessage] = useState(""),
    [draft, setDraft] = useState<OperationInput | null>(null),
    [warnings, setWarnings] = useState<string[]>([]),
    [edit, setEdit] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState(""),
    [side, setSide] = useState(""),
    [broker, setBroker] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [exercise, setExercise] = useState("2026"),
    [dark, setDark] = useState(false),
    [mobile, setMobile] = useState(false),
    [tab, setTab] = useState("Bens e Direitos");
  const loadEpoch = useRef(0);
  async function load() {
    const epoch = ++loadEpoch.current;
    try {
      const [a, b] = await Promise.all([
        fetch("/api/portfolio", { cache: "no-store" }),
        fetch("/api/operations", { cache: "no-store" }),
      ]);
      if (epoch !== loadEpoch.current) return false;
      if (a.status === 401 || b.status === 401) {
        setUser(null);
        setOps([]);
        setLoadError("");
        return false;
      }
      if (!a.ok || !b.ok) {
        const response = !a.ok ? a : b;
        const data = await response.json().catch(() => null);
        throw Error(
          data?.error ??
            "Não foi possível carregar sua carteira. Tente novamente.",
        );
      }
      const [profile, operations] = await Promise.all([a.json(), b.json()]);
      if (epoch !== loadEpoch.current) return false;
      setUser(profile);
      setOps(operations);
      setLoadError("");
      return true;
    } catch (e) {
      if (epoch === loadEpoch.current)
        setLoadError(
          e instanceof Error ? e.message : "Falha ao carregar os dados.",
        );
      return false;
    } finally {
      if (epoch === loadEpoch.current) setAuth(true);
    }
  }
  useEffect(() => {
    void load();
    try {
      setDark(localStorage.getItem("pipo-theme") === "dark");
    } catch {
      /* Storage may be unavailable in private sessions. */
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("pipo-theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  async function logout() {
    ++loadEpoch.current;
    setBusy(true);
    try {
      const r = await fetch("/api/auth", { method: "DELETE" });
      if (!r.ok) throw Error("Não foi possível sair. Tente novamente.");
      setUser(null);
      setOps([]);
      setDraft(null);
      setEdit(null);
      setMessage("");
      setRegister(false);
      setPage("Dashboard");
      setFilter("");
      setSide("");
      setBroker("");
      setFrom("");
      setTo("");
      setWarnings([]);
      setMobile(false);
      setNotice("");
      setLoadError("");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao sair.");
    } finally {
      setBusy(false);
    }
  }
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(f),
          mode: register ? "register" : "login",
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok)
        throw Error(d?.error ?? "O servidor não respondeu. Tente novamente.");
      if (await load()) setNotice("Bem-vindo à sua carteira.");
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "Não foi possível concluir a solicitação.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(cancel = false) {
    if (!draft) return;
    const parsed = operationSchema.safeParse(draft);
    if (!parsed.success) {
      setNotice(
        "Revise os campos: " +
          parsed.error.issues.map((i) => i.path.join(".")).join(", "),
      );
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          operation: parsed.data,
          id: edit,
          cancel,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok)
        throw Error(d?.error ?? "O servidor não respondeu. Tente novamente.");
      setDraft(null);
      setEdit(null);
      setMessage("");
      const refreshed = await load();
      if (!refreshed)
        setNotice(
          "A alteração foi salva, mas não foi possível atualizar a carteira. Recarregue para conferir.",
        );
      else
        setNotice(
          cancel
            ? "Operação cancelada. Auditoria preservada."
            : "Operação salva. Sua carteira foi atualizada.",
        );
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "Não foi possível concluir a solicitação.",
      );
    } finally {
      setBusy(false);
    }
  }
  const active = ops.filter((o) => !o.canceled);
  const selected = active.filter(
    (o) =>
      (!from || o.date.slice(0, 10) >= from) &&
      (!to || o.date.slice(0, 10) <= to) &&
      (!broker || o.broker === broker),
  );
  let holdings: ReturnType<typeof positions> = [],
    historical: ReturnType<typeof positions> = [],
    previous: ReturnType<typeof positions> = [],
    monthly: ReturnType<typeof monthlyResults> = [];
  let calculationError = "",
    realized = "0.00";
  const year = Number(exercise) - 1;
  try {
    holdings = positions(active, to || undefined);
    realized = realizedInPeriod(active, from, to || undefined, broker);
    historical = positions(active, `${year}-12-31`);
    previous = positions(active, `${year - 1}-12-31`);
    monthly = monthlyResults(active).filter((m) =>
      m.month.startsWith(String(year)),
    );
  } catch (e) {
    calculationError =
      e instanceof Error
        ? e.message
        : "Não foi possível calcular as posições. Revise o histórico.";
  }
  const cost = holdings
    .reduce((s, p) => s.add(p.costExact), new Decimal(0))
    .toFixed(2);
  const filtered = selected.filter(
    (o) =>
      o.ticker.includes(filter.toUpperCase()) && (!side || o.side === side),
  );
  const declarationPositions = historical.filter(
    (p) =>
      new Decimal(p.quantity).gt(0) ||
      previous.some(
        (old) => old.ticker === p.ticker && new Decimal(old.quantity).gt(0),
      ),
  );
  const issues = active.flatMap((o) => [
    ...(!o.broker
      ? [
          {
            id: o.id,
            text: `${o.ticker}: instituição financeira não informada.`,
          },
        ]
      : []),
    ...(o.modality === "DAY_TRADE"
      ? [
          {
            id: o.id,
            text: `${o.ticker}: day trade requer pareamento e apuração específica, ainda não disponíveis.`,
          },
        ]
      : []),
    ...(active.some(
      (p) =>
        p.id !== o.id &&
        p.ticker === o.ticker &&
        p.side !== o.side &&
        p.date.slice(0, 10) === o.date.slice(0, 10),
    )
      ? [
          {
            id: o.id,
            text: `${o.ticker}: compra e venda no mesmo dia. Revisar modalidade antes de usar o resultado fiscal.`,
          },
        ]
      : []),
  ]);
  function startEdit(o: Op) {
    setDraft({ ...o, date: o.date.slice(0, 10) } as OperationInput);
    setEdit(o.id);
    setPage("Operações");
    setWarnings(["A alteração será registrada no histórico de auditoria."]);
  }
  function navigate(name: string) {
    setPage(name);
    setMobile(false);
    setFrom("");
    setTo("");
    setBroker("");
  }
  async function copy(v: string) {
    try {
      await navigator.clipboard.writeText(v);
      setNotice("Copiado para a área de transferência.");
    } catch {
      setNotice("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }
  if (!auth)
    return (
      <div className="min-h-screen grid place-items-center">
        Carregando sua carteira…
      </div>
    );
  if (loadError)
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <section className="card max-w-lg">
          <h1 className="font-semibold text-xl mb-3">
            Não foi possível carregar sua carteira
          </h1>
          <p role="alert" className="text-sm text-red-700 mb-5">
            {loadError}
          </p>
          <p className="text-xs muted mb-5">
            Nenhum saldo é presumido enquanto os dados estão indisponíveis.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => load()}>Tentar novamente</Button>
            <Button disabled={busy} onClick={logout}>
              Sair da conta
            </Button>
          </div>
        </section>
      </div>
    );
  if (!user)
    return (
      <div className="min-h-screen grid lg:grid-cols-2">
        <section className="bg-[#102951] text-white p-12 flex flex-col justify-between">
          <div className="flex gap-3 items-center text-xl font-bold">
            <Leaf /> PIPO INVEST
          </div>
          <div>
            <span className="text-emerald-300 text-sm">
              MAIS CLAREZA. MELHORES DECISÕES.
            </span>
            <h1 className="text-5xl leading-tight font-semibold mt-5 mb-6">
              Seu patrimônio.
              <br />
              Tudo no lugar.
            </h1>
            <p className="text-blue-200 text-lg max-w-md">
              Organize seus investimentos, acompanhe sua carteira e prepare o
              Imposto de Renda com tranquilidade.
            </p>
          </div>
          <p className="text-blue-200 text-sm flex gap-2">
            <ShieldCheck size={18} /> Seus dados financeiros ficam na sua conta.
          </p>
        </section>
        <section className="p-8 flex items-center justify-center">
          <form onSubmit={login} className="max-w-sm w-full space-y-5">
            <p className="text-xs tracking-widest muted">BEM-VINDO AO PIPO</p>
            <h2 className="text-3xl font-semibold">
              {register ? "Crie sua conta" : "Acesse sua carteira"}
            </h2>
            <p className="muted text-sm">
              Seu próximo passo para investir com organização.
            </p>
            {register && (
              <label>
                Seu nome
                <input required name="name" minLength={2} maxLength={80} />
              </label>
            )}
            <label>
              E-mail
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Senha (mínimo de 12 caracteres)
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={72}
                autoComplete={register ? "new-password" : "current-password"}
              />
            </label>
            <Button disabled={busy} className="w-full">
              {busy ? "Aguarde…" : register ? "Criar conta" : "Entrar"}
              <ArrowUpRight size={16} />
            </Button>
            <button
              type="button"
              className="text-sm text-blue-600"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setNotice("");
              }}
            >
              {register ? "Já tenho uma conta" : "Ainda não tenho conta"}
            </button>
            <p role="status" className="text-sm text-red-600">
              {notice}
            </p>
            <p className="text-xs muted">
              Ao criar sua conta, você armazena seus dados neste serviço para
              controle da carteira. Nenhum dado financeiro é enviado a uma IA
              externa.
            </p>
          </form>
        </section>
      </div>
    );
  return (
    <div className="min-h-screen">
      <aside
        id="pipo-sidebar"
        className={`${mobile ? "flex" : "hidden"} lg:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-30 flex-col p-6`}
      >
        <div className="flex items-center gap-2 text-lg tracking-tight font-extrabold mt-2 mb-12">
          <span className="bg-blue-950 text-white rounded-xl p-2">
            <Leaf size={23} />
          </span>
          PIPO <span className="font-normal text-slate-400">INVEST</span>
        </div>
        <p className="text-[10px] font-semibold tracking-[.18em] muted px-3 mb-4">
          SEU ESPAÇO FINANCEIRO
        </p>
        <nav aria-label="Navegação principal" className="space-y-2">
          {sections.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => navigate(name)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left ${page === name ? "bg-blue-50 text-blue-800 font-semibold" : "muted hover:bg-slate-100"}`}
            >
              <Icon size={19} />
              {name}
              {name === "Conciliação" && issues.length > 0 && (
                <span className="ml-auto text-xs rounded bg-amber-100 text-amber-700 px-2">
                  {issues.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto">
          <div className="rounded-xl bg-slate-50 p-4 text-slate-700 mb-6">
            <ShieldCheck className="text-emerald-600 mb-3" size={22} />
            <p className="text-sm font-semibold">
              Organização traz tranquilidade
            </p>
            <p className="text-xs muted mt-2 leading-relaxed">
              Mantenha suas operações em dia. Seu eu do próximo IR agradece.
            </p>
          </div>
          <button
            onClick={logout}
            disabled={busy}
            className="flex gap-3 text-xs muted items-center"
          >
            <LogOut size={16} /> Sair da conta
          </button>
        </div>
      </aside>
      <div className="lg:ml-64">
        <header className="bg-white border-b border-slate-200 px-6 lg:px-10 h-20 flex justify-between items-center">
          <div className="flex gap-3 items-center">
            <button
              aria-label="Abrir navegação"
              aria-expanded={mobile}
              aria-controls="pipo-sidebar"
              onClick={() => setMobile(!mobile)}
              className="lg:hidden"
            >
              <Menu />
            </button>
            <span className="text-sm muted">Minha carteira</span>
            <ChevronRight size={14} className="muted" />
            <span className="text-sm font-medium">{page}</span>
          </div>
          <div className="flex items-center gap-5">
            <button aria-label="Alternar tema" onClick={() => setDark(!dark)}>
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs muted">Investidor pessoa física</p>
            </div>
            <span className="rounded-full bg-blue-100 text-blue-900 w-10 h-10 grid place-items-center font-semibold">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <main className="p-5 lg:p-10 max-w-[1500px] mx-auto">
          <div className="flex flex-wrap justify-between gap-4 items-end mb-8">
            <div>
              <p className="text-xs muted mb-2">
                {new Date().toLocaleDateString("pt-BR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "America/Sao_Paulo",
                })}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                {page === "Dashboard" ? `Seu dinheiro, com clareza.` : page}
              </h1>
              <p className="muted text-sm mt-2">
                {page === "Dashboard"
                  ? "Uma visão completa para cuidar do seu futuro."
                  : page === "Operações"
                    ? "Conte o que você negociou. A gente organiza para você."
                    : page === "Imposto de Renda"
                      ? "Suas informações organizadas, da carteira à declaração."
                      : page === "Conciliação"
                        ? "Revise os detalhes e mantenha sua carteira consistente."
                        : "Sua conta e a transparência dos seus dados."}
              </p>
            </div>
            <Button
              onClick={() => {
                setPage("Operações");
                setDraft(null);
                setEdit(null);
                setWarnings([]);
              }}
            >
              <Plus size={17} /> Nova operação
            </Button>
          </div>
          {notice && (
            <div
              role="status"
              className="mb-5 p-3 rounded-xl bg-blue-50 text-blue-900 text-sm flex justify-between gap-4"
            >
              {notice}
              <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          {calculationError && (
            <p role="alert" className="text-red-600 mb-4">
              {calculationError}
            </p>
          )}
          {page === "Dashboard" && !calculationError && (
            <>
              <div className="flex flex-wrap gap-3 mb-6 no-print">
                <label>
                  De
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label>
                  Até
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
                <label>
                  Instituição
                  <select
                    value={broker}
                    onChange={(e) => setBroker(e.target.value)}
                  >
                    <option value="">Todas as instituições</option>
                    {[...new Set(active.map((o) => o.broker))]
                      .filter(Boolean)
                      .map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
                {[
                  {
                    label: "Custo de aquisição",
                    value: brl(cost),
                    icon: Wallet,
                    sub: "Posição consolidada até a data final",
                  },
                  {
                    label: "Resultado realizado",
                    value: brl(realized),
                    icon: TrendingUp,
                    sub: "Resultado das vendas no período selecionado",
                  },
                  {
                    label: "Ativos em carteira",
                    value: String(
                      holdings.filter((p) => new Decimal(p.quantity).gt(0))
                        .length,
                    ).padStart(2, "0"),
                    icon: Layers,
                    sub: "Posições com saldo positivo",
                  },
                  {
                    label: "Operações registradas",
                    value: String(selected.length).padStart(2, "0"),
                    icon: ArrowLeftRight,
                    sub: "Histórico confirmado por você",
                  },
                ].map((c) => (
                  <div key={c.label} className="card">
                    <div className="flex justify-between items-center">
                      <p className="text-sm muted">{c.label}</p>
                      <c.icon className="text-slate-400" size={19} />
                    </div>
                    <p className="text-3xl font-semibold mt-5 mb-3 tracking-tight">
                      {c.value}
                    </p>
                    <p className="text-xs muted">{c.sub}</p>
                  </div>
                ))}
              </div>
              <div className="grid xl:grid-cols-3 gap-6 mb-6">
                <section className="card xl:col-span-2">
                  <div className="flex justify-between">
                    <div>
                      <h2 className="font-semibold">Sua carteira</h2>
                      <p className="text-xs muted mt-1">
                        Custo consolidado por ativo até a data final
                      </p>
                    </div>
                    <span className="text-xs rounded-lg bg-slate-100 text-slate-500 p-2 h-fit">
                      Sem cotações ao vivo
                    </span>
                  </div>
                  {holdings.length ? (
                    <div className="h-64 mt-6">
                      <ResponsiveContainer>
                        <BarChart
                          data={holdings.map((p) => ({
                            name: p.ticker,
                            custo: Number(p.cost),
                          }))}
                        >
                          <CartesianGrid vertical={false} stroke="#edf1f6" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip formatter={(v) => brl(String(v))} />
                          <Bar
                            dataKey="custo"
                            fill="#244c86"
                            radius={[7, 7, 0, 0]}
                            maxBarSize={50}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <Empty
                      title="O primeiro passo é seu"
                      text="Registre uma compra para começar a acompanhar sua carteira."
                      action={() => setPage("Operações")}
                    />
                  )}
                  <p className="text-xs muted border-t pt-4 mt-3">
                    Posições consolidadas entre instituições. O filtro de
                    instituição aplica-se às operações e ao resultado realizado.
                    Valor de mercado e rentabilidade indisponíveis sem cotações.
                  </p>
                </section>
                <section className="card">
                  <h2 className="font-semibold">Distribuição da carteira</h2>
                  <p className="text-xs muted mt-1">
                    Participação no custo de aquisição
                  </p>
                  {holdings.some((p) => new Decimal(p.cost).gt(0)) ? (
                    <>
                      <div className="h-52">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={holdings
                                .filter((p) => Number(p.cost) > 0)
                                .map((p) => ({
                                  name: p.ticker,
                                  value: Number(p.cost),
                                }))}
                              dataKey="value"
                              innerRadius={57}
                              outerRadius={82}
                              paddingAngle={4}
                            >
                              {holdings.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={
                                    [
                                      "#153a68",
                                      "#31b6a1",
                                      "#81a5d8",
                                      "#bad5e7",
                                    ][i % 4]
                                  }
                                />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => brl(String(v))} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {holdings.map((p) => (
                        <div
                          key={p.ticker}
                          className="flex justify-between text-xs py-2"
                        >
                          <span>{p.ticker}</span>
                          <span>{brl(p.cost)}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <Empty
                      title="Cada ativo, seu espaço"
                      text="A distribuição aparecerá após sua primeira operação."
                    />
                  )}
                </section>
              </div>
              <section className="card">
                <div className="flex justify-between mb-5">
                  <h2 className="font-semibold">Últimas operações</h2>
                  <button
                    className="text-xs text-blue-600"
                    onClick={() => setPage("Operações")}
                  >
                    Ver histórico completo →
                  </button>
                </div>
                <History
                  ops={selected.slice(-5).reverse()}
                  onEdit={startEdit}
                />
              </section>
              <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-5 flex gap-4 text-emerald-900">
                <ShieldCheck />
                <div>
                  <p className="text-sm font-semibold">
                    Seu próximo IR começa com uma carteira organizada.
                  </p>
                  <p className="text-xs mt-1">
                    Confira os dados de aquisição e revise as pendências antes
                    de preparar sua declaração.
                  </p>
                </div>
              </div>
            </>
          )}
          {page === "Operações" && (
            <>
              <section className="card mb-6">
                <div className="flex flex-wrap gap-3 items-center mb-6">
                  <span className="bg-blue-50 text-blue-800 p-3 rounded-xl">
                    <ArrowLeftRight size={22} />
                  </span>
                  <div>
                    <h2 className="font-semibold">
                      Vamos registrar uma operação?
                    </h2>
                    <p className="text-xs muted mt-1">
                      Escreva naturalmente. Você revisa tudo antes de salvar.
                    </p>
                  </div>
                  <span className="ml-auto text-[10px] text-emerald-700 bg-emerald-50 p-2 rounded-full">
                    PARSER LOCAL · SEM IA EXTERNA
                  </span>
                </div>
                <div className="bg-slate-50 text-slate-500 rounded-xl p-5 text-sm mb-4">
                  Por exemplo: “Comprei 3 PETR4 a 10 em 16/10/2026.”
                </div>
                <form
                  className="flex gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const p = interpreter.parse(message, today());
                    setDraft({ ...empty, ...p.draft });
                    setWarnings(p.warnings);
                    setEdit(null);
                  }}
                >
                  <input
                    aria-label="Descreva sua operação"
                    placeholder="Comprei 20 VALE3 a 62,40…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    maxLength={1000}
                  />
                  <Button aria-label="Interpretar mensagem" type="submit">
                    <Send size={18} />
                    <span className="hidden sm:inline">Interpretar</span>
                  </Button>
                </form>
                <p className="text-xs muted mt-3 flex gap-2">
                  <ShieldCheck size={14} /> Nada é registrado sem sua
                  confirmação explícita.
                </p>
              </section>
              {draft && (
                <section className="card mb-6 border-blue-300">
                  <h2 className="font-semibold mb-2">
                    {edit ? "Editar operação" : "Confira sua operação"}
                  </h2>
                  {warnings.map((w) => (
                    <p key={w} className="text-xs text-amber-700 my-2">
                      {w}
                    </p>
                  ))}
                  <div className="grid sm:grid-cols-3 gap-4 my-5">
                    {(
                      [
                        ["ticker", "Ativo"],
                        ["quantity", "Quantidade"],
                        ["price", "Preço unitário (decimal com ponto)"],
                        ["fees", "Taxas (decimal com ponto)"],
                        ["date", "Data"],
                        ["broker", "Corretora"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          value={draft[key]}
                          type={key === "date" ? "date" : "text"}
                          onChange={(e) =>
                            setDraft({ ...draft, [key]: e.target.value })
                          }
                        />
                      </label>
                    ))}
                    <label>
                      Tipo
                      <select
                        value={draft.side}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            side: e.target.value as OperationInput["side"],
                          })
                        }
                      >
                        <option value="BUY">Compra</option>
                        <option value="SELL">Venda</option>
                      </select>
                    </label>
                    <label>
                      Classe
                      <select
                        value={draft.assetClass}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            assetClass: e.target
                              .value as OperationInput["assetClass"],
                          })
                        }
                      >
                        <option value="ACAO">Ação brasileira</option>
                        <option value="FII">FII</option>
                        <option value="ETF">ETF brasileiro</option>
                      </select>
                    </label>
                    <label>
                      Modalidade
                      <select
                        value={draft.modality}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            modality: e.target
                              .value as OperationInput["modality"],
                          })
                        }
                      >
                        <option value="COMUM">Comum</option>
                        <option value="DAY_TRADE">
                          Day trade (apuração pendente)
                        </option>
                      </select>
                    </label>
                  </div>
                  <p className="text-sm mb-4">
                    Valor bruto:{" "}
                    {/^\d+(\.\d+)?$/.test(draft.quantity) &&
                    /^\d+(\.\d+)?$/.test(draft.price)
                      ? brl(
                          new Decimal(draft.quantity)
                            .mul(draft.price)
                            .toFixed(2),
                        )
                      : "Preencha quantidade e preço"}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button disabled={busy} onClick={() => save()}>
                      <Check size={16} /> Confirmar e salvar
                    </Button>
                    <Button
                      className="bg-slate-200 text-slate-700"
                      onClick={() => {
                        setDraft(null);
                        setEdit(null);
                      }}
                    >
                      Descartar prévia
                    </Button>
                    {edit && (
                      <Button
                        className="bg-red-700"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Confirmar cancelamento desta operação? O registro de auditoria será mantido.",
                            )
                          )
                            save(true);
                        }}
                      >
                        Cancelar operação registrada
                      </Button>
                    )}
                  </div>
                </section>
              )}
              <section className="card">
                <div className="flex flex-wrap justify-between gap-4 mb-5">
                  <h2 className="font-semibold">Histórico de operações</h2>
                  <div className="flex gap-4 text-xs text-blue-700">
                    <a href="/api/export">Exportar CSV</a>
                    <a href="/api/export?format=xlsx">Exportar XLSX</a>
                  </div>
                </div>
                <div className="grid sm:grid-cols-5 gap-3 mb-5">
                  <label>
                    Ativo
                    <input
                      placeholder="Buscar ticker"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      value={side}
                      onChange={(e) => setSide(e.target.value)}
                    >
                      <option value="">Todos</option>
                      <option value="BUY">Compra</option>
                      <option value="SELL">Venda</option>
                    </select>
                  </label>
                  <label>
                    De
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    Até
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </label>
                  <label>
                    Corretora
                    <input
                      value={broker}
                      onChange={(e) => setBroker(e.target.value)}
                    />
                  </label>
                </div>
                <History ops={filtered.slice().reverse()} onEdit={startEdit} />
              </section>
              <Importer onDone={() => load()} />
            </>
          )}
          {page === "Imposto de Renda" && !calculationError && (
            <>
              <div className="card flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex gap-4 items-center">
                  <FileText className="text-blue-700" />
                  <label>
                    Exercício
                    <select
                      value={exercise}
                      onChange={(e) => setExercise(e.target.value)}
                    >
                      {[2025, 2026, 2027].map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                    </select>
                  </label>
                  <span className="text-sm muted">Ano-calendário {year}</span>
                </div>
                <Button onClick={() => window.print()}>
                  <Download size={16} /> Imprimir / salvar PDF
                </Button>
              </div>
              <div className="bg-amber-50 text-amber-900 border border-amber-200 rounded-xl p-4 mb-6 text-sm flex gap-3">
                <AlertTriangle size={21} className="shrink-0" />
                <p>
                  Regras e códigos do exercício {exercise} ainda não validados
                  contra o manual oficial. Esta página é um relatório auxiliar
                  de custos, não uma declaração pronta. Nenhum imposto devido é
                  estimado.{" "}
                  <a
                    className="underline"
                    href="https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Consultar Receita Federal
                  </a>
                  .
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  "Bens e Direitos",
                  "Isentos e Não Tributáveis",
                  "Tributação Exclusiva",
                  "Renda Variável",
                  "Exterior",
                ].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-lg px-3 py-2 text-xs ${tab === t ? "bg-blue-950 text-white" : "bg-white border text-slate-500"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tab === "Bens e Direitos" ? (
                <section className="card">
                  <h2 className="font-semibold mb-2">
                    Posição em 31/12/{year}
                  </h2>
                  <p className="text-xs muted mb-6">
                    Valores pelo custo de aquisição, incluindo taxas de compra.
                    Titular: {user.name}. Grupo, código, localização e CNPJ
                    exigem validação e complementação.
                  </p>
                  {declarationPositions.map((p) => {
                    const old = previous.find((a) => a.ticker === p.ticker);
                    const text = `${p.quantity} unidades de ${p.ticker}, custo de aquisição de ${brl(p.cost)} em 31/12/${year}. Confirmar instituição custodiante, CNPJ e campos exigidos pelo exercício.`;
                    return (
                      <article
                        key={p.ticker}
                        className="border rounded-xl p-5 mb-4"
                      >
                        <div className="flex justify-between">
                          <h3 className="font-semibold">{p.ticker}</h3>
                          <span className="text-xs text-amber-700">
                            Classificação pendente
                          </span>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-4 my-4">
                          <div className="text-xs muted">
                            Quantidade
                            <p className="text-base mt-1">{p.quantity}</p>
                          </div>
                          {[
                            [`31/12/${year - 1}`, old?.cost ?? "0"],
                            [`31/12/${year}`, p.cost],
                          ].map(([label, value]) => (
                            <div key={label} className="text-xs muted">
                              Situação em {label}
                              <button
                                className="flex gap-2 text-base mt-1"
                                onClick={() => copy(value)}
                              >
                                {brl(value)}
                                <Copy size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs leading-relaxed muted mb-3">
                          {text}
                        </p>
                        <button
                          className="text-xs text-blue-600 flex gap-2"
                          onClick={() => copy(text)}
                        >
                          <Copy size={14} /> Copiar discriminação auxiliar
                        </button>
                        <details className="mt-4 text-xs muted">
                          <summary>Origem e operações relacionadas</summary>
                          {active
                            .filter(
                              (o) =>
                                o.ticker === p.ticker &&
                                o.date.slice(0, 10) <= `${year}-12-31`,
                            )
                            .map((o) => (
                              <p className="mt-2" key={o.id}>
                                {o.date.slice(0, 10)} ·{" "}
                                {o.side === "BUY" ? "Compra" : "Venda"} ·{" "}
                                {o.quantity} × {brl(o.price)} · taxas{" "}
                                {brl(o.fees)}
                              </p>
                            ))}
                        </details>
                      </article>
                    );
                  })}
                  {!declarationPositions.length && (
                    <Empty
                      title="Nenhuma posição neste encerramento"
                      text={`Não há ativos com saldo registrado em 31/12/${year}.`}
                    />
                  )}
                </section>
              ) : tab === "Renda Variável" ? (
                <section className="card">
                  <h2 className="font-semibold">
                    Resultados realizados por mês — relatório financeiro
                  </h2>
                  <p className="text-xs text-amber-700 my-3">
                    Apuração fiscal, pareamento de day trade, isenções, IRRF,
                    DARF e compensação de prejuízos estão pendentes. Não use
                    estes totais como imposto apurado.
                  </p>
                  {monthly.map((m) => (
                    <div
                      key={m.month}
                      className="flex justify-between border-b py-4 text-sm"
                    >
                      <span>{m.month}</span>
                      <span>{brl(m.result)}</span>
                    </div>
                  ))}
                </section>
              ) : (
                <section className="card">
                  <Empty
                    title={
                      tab === "Exterior"
                        ? "Tratamento independente para ativos no exterior"
                        : "Sem rendimentos classificados"
                    }
                    text="Esta ficha depende de cadastro de rendimentos e regras oficiais versionadas, ainda não implementados. Nenhum valor zero é presumido."
                  />
                </section>
              )}
            </>
          )}
          {page === "Conciliação" && (
            <>
              <div className="grid sm:grid-cols-3 gap-5 mb-6">
                <div className="card">
                  <p className="muted text-sm">
                    Pendências de cadastro e modalidade
                  </p>
                  <p className="text-3xl font-semibold mt-4">{issues.length}</p>
                </div>
                <div className="card">
                  <p className="muted text-sm">Integridade das posições</p>
                  <p className="text-lg text-emerald-600 mt-4">
                    {calculationError
                      ? "Revisão necessária"
                      : "Sem posições negativas"}
                  </p>
                </div>
                <div className="card">
                  <p className="muted text-sm">Validação fiscal</p>
                  <p className="text-lg text-amber-600 mt-4">
                    Pendente para todos os exercícios
                  </p>
                </div>
              </div>
              <section className="card">
                <h2 className="font-semibold mb-5">
                  Itens que merecem sua atenção
                </h2>
                {issues.length ? (
                  issues.map((i, index) => (
                    <div
                      key={index}
                      className="border-b py-4 flex gap-4 items-center"
                    >
                      <AlertTriangle
                        className="text-amber-500 shrink-0"
                        size={19}
                      />
                      <p className="text-sm flex-1">{i.text}</p>
                      <button
                        className="text-xs text-blue-700"
                        onClick={() =>
                          startEdit(ops.find((o) => o.id === i.id)!)
                        }
                      >
                        Revisar operação
                      </button>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="Cadastros sem pendências identificadas"
                    text="Isso não substitui a conferência com extratos e notas de corretagem."
                  />
                )}
                <p className="text-xs muted mt-5">
                  Duplicidades exatas e vendas sem saldo são bloqueadas no
                  registro. Nenhuma operação é corrigida automaticamente.
                  Conciliação com extratos externos ainda não disponível.
                </p>
              </section>
            </>
          )}
          {page === "Configurações" && (
            <div className="grid lg:grid-cols-2 gap-6">
              <section className="card">
                <h2 className="font-semibold mb-5">Minha conta</h2>
                <p className="text-sm mb-2">{user.name}</p>
                <p className="muted text-sm mb-6">{user.email}</p>
                <h3 className="text-sm font-semibold mb-2">
                  Privacidade e dados
                </h3>
                <p className="text-xs muted leading-relaxed">
                  Mensagens são interpretadas localmente por regras
                  determinísticas. Operações são armazenadas em PostgreSQL com
                  acesso restrito ao seu usuário. Não há conexão com corretoras
                  nem serviço externo de inteligência artificial.
                </p>
                <div className="flex gap-4 text-sm text-blue-600 mt-5">
                  <a href="/api/export">Baixar operações em CSV</a>
                  <a href="/api/export?format=xlsx">Baixar XLSX</a>
                </div>
                <p className="text-xs muted mt-5">
                  Recuperação de senha, MFA, exclusão de conta e gestão de
                  consentimentos ainda pendentes. Uso de produção depende desses
                  controles e de revisão de segurança.
                </p>
              </section>
              <section className="card">
                <h2 className="font-semibold mb-4">Registro de auditoria</h2>
                {user.audit.length ? (
                  user.audit.map((a, i) => (
                    <div key={i} className="border-b py-3 text-xs">
                      <span className="font-semibold">{a.action}</span>
                      <span className="muted ml-3">
                        {new Date(a.createdAt).toLocaleString("pt-BR")}
                      </span>
                      <p className="muted mt-1 break-all">
                        Operação {a.entityId}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="muted text-sm">
                    Suas alterações aparecerão aqui.
                  </p>
                )}
              </section>
            </div>
          )}
          <footer className="flex flex-wrap justify-between gap-3 mt-10 text-[11px] muted border-t pt-5">
            <span>PIPO INVEST · Organização para investir melhor.</span>
            <span>
              Valores em BRL · Dados informados por você · Sem recomendação de
              investimento
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: () => void;
}) {
  return (
    <div className="py-12 text-center">
      <div className="rounded-2xl bg-blue-50 text-blue-700 w-12 h-12 grid place-items-center mx-auto mb-4">
        <Layers size={22} />
      </div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs muted mt-2 max-w-sm mx-auto leading-relaxed">
        {text}
      </p>
      {action && (
        <button
          onClick={action}
          className="text-xs text-blue-700 font-semibold mt-5"
        >
          Registrar primeira operação →
        </button>
      )}
    </div>
  );
}
function History({ ops, onEdit }: { ops: Op[]; onEdit: (o: Op) => void }) {
  return ops.length ? (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="text-[10px] tracking-wider muted uppercase border-b">
          <tr>
            {[
              "Ativo / instituição",
              "Operação",
              "Data",
              "Quantidade",
              "Preço unitário",
              "Total bruto",
              "",
            ].map((t, i) => (
              <th key={i} className="pb-4 pr-5 font-medium">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ops.map((o) => (
            <tr key={o.id} className="border-b last:border-0">
              <td className="py-4 pr-5">
                <p className="font-semibold">{o.ticker}</p>
                <p className="text-[10px] muted mt-1">
                  {o.broker || "Instituição não informada"}
                </p>
              </td>
              <td className="pr-5">
                <span
                  className={`text-xs px-2 py-1 rounded-md ${o.side === "BUY" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                >
                  {o.side === "BUY" ? "Compra" : "Venda"}
                </span>
              </td>
              <td className="pr-5 muted text-xs">
                {o.date.slice(0, 10).split("-").reverse().join("/")}
              </td>
              <td className="pr-5">{o.quantity}</td>
              <td className="pr-5">{brl(o.price)}</td>
              <td className="pr-5 font-medium">
                {brl(new Decimal(o.quantity).mul(o.price).toFixed(2))}
              </td>
              <td>
                <button
                  className="text-xs text-blue-600"
                  onClick={() => onEdit(o)}
                >
                  Detalhes / editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title="Seu histórico começa aqui"
      text="As operações confirmadas aparecerão nesta lista. Nenhum dado de demonstração é misturado à sua carteira."
    />
  );
}
