export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">D</span>
          </div>
          <div>
            <p className="text-sm font-semibold">DoorStax Help Center</p>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
