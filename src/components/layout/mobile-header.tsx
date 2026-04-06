"use client";

import { Logo } from "./logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/actions/auth";
import { LogOut } from "lucide-react";

interface MobileHeaderProps {
  user: {
    name: string;
    role: string;
  } | null;
}

export function MobileHeader({ user }: MobileHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 h-14 border-b md:hidden">
      <Logo />

      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {user?.name?.slice(0, 2).toUpperCase() ?? "??"}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <p className="font-medium">{user?.name ?? "Jogador"}</p>
              <p className="text-xs text-muted-foreground capitalize font-normal">
                {user?.role ?? "player"}
              </p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <form action={logout} className="w-full">
              <button type="submit" className="flex items-center gap-2 w-full text-sm">
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
