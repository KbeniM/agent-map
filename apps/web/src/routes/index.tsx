import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { NodePanel } from "@/components/node-panel";
import { SessionsPanel } from "@/components/sessions-panel";

const searchSchema = z.object({ node: z.string().max(300).optional() });

export const Route = createFileRoute("/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: Home,
});

function Home() {
  const { node } = Route.useSearch();
  return (
    <>
      <SessionsPanel selected={node} />
      {node && <NodePanel id={node} />}
    </>
  );
}
