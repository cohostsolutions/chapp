export function AgentVideoDemo() {
  return (
    <section className="py-24 bg-gradient-to-b from-card/30 to-background">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">See Our AI Agents in Action</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
          Watch a quick demo of Jay, May, and Cece handling real customer scenarios.
        </p>
        <div className="aspect-w-16 aspect-h-9 rounded-2xl overflow-hidden shadow-lg border border-border mx-auto max-w-3xl">
          <iframe
            src="https://www.youtube.com/embed/dQw4w9WgXcQ"
            title="AI Agent Demo Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </div>
    </section>
  );
}
