import { TESTIMONIALS } from '@/constants/testimonials';

export function TestimonialsSection() {
  return (
    <section className="py-24 bg-gradient-to-b from-background to-card/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">What Our Customers Say</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Real feedback from businesses using our AI agents to automate and grow.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl bg-card/50 border border-border/50 p-8 flex flex-col items-center text-center shadow-md">
              <img src={t.avatar} alt={t.name} className="w-16 h-16 rounded-full mb-4 object-cover" />
              <h3 className="text-lg font-semibold text-foreground mb-1">{t.name}</h3>
              <p className="text-sm text-muted-foreground mb-2">{t.company} &middot; {t.industry}</p>
              <p className="text-base text-foreground mb-4">“{t.text}”</p>
              <div className="flex gap-1 justify-center">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <span key={i} className="text-yellow-400 text-lg">★</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
