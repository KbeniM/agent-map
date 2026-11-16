import { useEffect } from "react";
import { type Bridge, usePreferences } from "@/stores/preferences";
import { connectBridge } from "./bridge-stream";

function BridgeStream({ bridge }: { bridge: Bridge }) {
  useEffect(() => connectBridge(bridge), [bridge]);
  return null;
}

export function BridgeStreams() {
  const bridges = usePreferences((state) => state.bridges);
  return bridges.filter((bridge) => bridge.enabled).map((bridge) => <BridgeStream key={bridge.id} bridge={bridge} />);
}
