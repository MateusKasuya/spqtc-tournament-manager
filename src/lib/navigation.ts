import {
  LayoutDashboard,
  Trophy,
  Medal,
  Users,
  BarChart3,
} from "lucide-react";

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Torneios", href: "/torneios", icon: Trophy },
  { label: "Ranking", href: "/ranking", icon: Medal },
  { label: "Jogadores", href: "/jogadores", icon: Users },
  { label: "Relatorios", href: "/relatorios", icon: BarChart3 },
] as const;
