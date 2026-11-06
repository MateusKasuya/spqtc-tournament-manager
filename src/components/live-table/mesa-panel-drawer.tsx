"use client";

import { useState } from "react";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { MesaPanelId, MesaPanelsView } from "@/lib/mesa-panels";
import { PlayersPanel } from "./panels/players-panel";
import { AverageStackPanel } from "./panels/average-stack-panel";
import { ChipsInPlayPanel } from "./panels/chips-in-play-panel";
import { PrizePoolPanel } from "./panels/prize-pool-panel";
import { BountyPanel } from "./panels/bounty-panel";
import { LevelPanel } from "./panels/level-panel";

const PANEL_TITLE: Record<MesaPanelId, string> = {
  players: "Jogadores",
  averageStack: "Stack medio",
  chipsInPlay: "Fichas em jogo",
  prizePool: "Prize pool",
  bounty: "Bounty em jogo",
  level: "Nivel",
};

interface MesaPanelDrawerProps {
  openPanel: MesaPanelId | null;
  view: MesaPanelsView;
  // Troca o painel aberto sem fechar a gaveta (o atalho do Jogadores para o Prize pool).
  onOpenPanel: (panel: MesaPanelId) => void;
  onClose: () => void;
}

// Gaveta só de consulta com o painel aberto. Quem guarda qual painel está aberto
// é a mesa: o snapshot é re-semeado a cada ressincronização e a gaveta não fecha.
export function MesaPanelDrawer({ openPanel, view, onOpenPanel, onClose }: MesaPanelDrawerProps) {
  // Mantém o último painel enquanto a gaveta anima a saída, para ela não sair vazia.
  const [shownPanel, setShownPanel] = useState<MesaPanelId | null>(openPanel);
  if (openPanel !== null && openPanel !== shownPanel) setShownPanel(openPanel);

  return (
    <Drawer
      open={openPanel !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onOpenChangeComplete={(open) => {
        if (!open) setShownPanel(null);
      }}
    >
      <DrawerContent>
        {shownPanel !== null && (
          <>
            <DrawerHeader>
              <DrawerTitle>{PANEL_TITLE[shownPanel]}</DrawerTitle>
            </DrawerHeader>
            <DrawerBody>
              <PanelBody panel={shownPanel} view={view} onOpenPanel={onOpenPanel} />
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// Um caso por painel, já ligado ao componente do painel: cada ticket de painel
// preenche só o próprio componente em `panels/`.
function PanelBody({ panel, view, onOpenPanel }: {
  panel: MesaPanelId;
  view: MesaPanelsView;
  onOpenPanel: (panel: MesaPanelId) => void;
}) {
  switch (panel) {
    case "players":
      return <PlayersPanel panel={view.players.panel} onOpenPrizePool={() => onOpenPanel("prizePool")} />;
    case "averageStack":
      return <AverageStackPanel panel={view.averageStack.panel} />;
    case "chipsInPlay":
      return <ChipsInPlayPanel panel={view.chipsInPlay.panel} />;
    case "prizePool":
      return <PrizePoolPanel panel={view.prizePool.panel} />;
    case "bounty":
      // Fora do Bounty Builder não há card de Bounty, então a gaveta não abre nele.
      return view.bounty && <BountyPanel panel={view.bounty.panel} />;
    case "level":
      return <LevelPanel panel={view.level.panel} />;
  }
}
