"use client";

import { useState } from "react";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { MesaPanelId, MesaPanelsView } from "@/lib/mesa-panels";
import { ChipsInPlayPanel } from "./panels/chips-in-play-panel";

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
  onClose: () => void;
}

// Gaveta só de consulta com o painel aberto. Quem guarda qual painel está aberto
// é a mesa: o snapshot é re-semeado a cada ressincronização e a gaveta não fecha.
export function MesaPanelDrawer({ openPanel, view, onClose }: MesaPanelDrawerProps) {
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
              <PanelBody panel={shownPanel} view={view} />
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// Um caso por painel; cada ticket de painel preenche só o seu.
function PanelBody({ panel, view }: { panel: MesaPanelId; view: MesaPanelsView }) {
  switch (panel) {
    case "players":
      return null;

    case "averageStack":
      return null;

    case "chipsInPlay":
      return <ChipsInPlayPanel panel={view.chipsInPlay.panel} />;

    case "prizePool":
      return null;

    case "bounty":
      return null;

    case "level":
      return null;
  }
}
