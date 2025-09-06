import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RiskBadgeProps {
  riskLevel: 'low' | 'medium' | 'high';
  riskScore?: number;
  className?: string;
}

export function RiskBadge({ riskLevel, riskScore, className }: RiskBadgeProps) {
  const getRiskConfig = () => {
    switch (riskLevel) {
      case 'low':
        return {
          label: 'Low Risk',
          className: 'bg-risk-low text-risk-low-foreground hover:bg-risk-low/80',
          emoji: '🟩',
        };
      case 'medium':
        return {
          label: 'Medium Risk',
          className: 'bg-risk-medium text-risk-medium-foreground hover:bg-risk-medium/80',
          emoji: '🟨',
        };
      case 'high':
        return {
          label: 'High Risk',
          className: 'bg-risk-high text-risk-high-foreground hover:bg-risk-high/80',
          emoji: '🟥',
        };
      default:
        return {
          label: 'Unknown',
          className: 'bg-muted text-muted-foreground',
          emoji: '⚪',
        };
    }
  };

  const config = getRiskConfig();
  const displayText = riskScore 
    ? `${config.label} (${Math.round(riskScore * 100)}%)`
    : config.label;

  return (
    <Badge
      className={cn(config.className, className)}
      variant="default"
    >
      <span className="mr-1">{config.emoji}</span>
      {displayText}
    </Badge>
  );
}