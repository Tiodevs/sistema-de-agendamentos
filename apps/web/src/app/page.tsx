export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary">
      <div className="w-[90%] max-w-[600px] rounded-xl border border-border bg-card/50 p-12 text-center backdrop-blur-lg">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground">
          📅 Sistema de Agendamentos
        </h1>
        <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
          Bem-vindo ao sistema de agendamentos. Em breve, novas funcionalidades!
        </p>
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-5 py-2 text-sm font-medium text-green-400">
            🟢 Online
          </span>
        </div>
      </div>
    </main>
  );
}
