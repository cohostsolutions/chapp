import { AGENTS } from '@/constants/agents';
import { cn } from '@/lib/utils';

const FEATURE_LIST = [
  'Lead qualification 24/7',
  'Configurable handoff workflow',
  'Google Calendar integration',
  'Meta integration (FB, WhatsApp, IG)',
  'Temperature-based lead prioritization',
  'Knowledge base support',
  'Multi-language support (Taglish)',
  'Automated order taking',
  'Menu management',
  'Pickup scheduling',
  'Order notifications',
  'Real-time availability checking',
  'Room booking management',
  'Automated guest messaging',
];

export function AgentComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background my-8">
      <table className="min-w-full text-sm text-left">
        <thead>
          <tr>
            <th className="p-4 font-bold text-lg bg-muted/50">Feature</th>
            {AGENTS.map(agent => (
              <th key={agent.name} className={cn('p-4 font-bold text-lg', agent.textColor)}>
                <span className="flex items-center gap-2">
                  <agent.icon className={cn('w-5 h-5', agent.textColor)} />
                  {agent.name}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">{agent.role}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_LIST.map(feature => (
            <tr key={feature} className="border-t border-border">
              <td className="p-4 font-medium">{feature}</td>
              {AGENTS.map(agent => (
                <td key={agent.name} className="p-4 text-center">
                  {agent.features.includes(feature) ? (
                    <span className="inline-block w-5 h-5 rounded-full bg-green-500/20 text-green-600 flex items-center justify-center mx-auto">
                      ✓
                    </span>
                  ) : (
                    <span className="inline-block w-5 h-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                      —
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
