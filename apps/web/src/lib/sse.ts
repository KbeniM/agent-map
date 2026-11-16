export type Message = { id?: string; event: string; data: string };

// why: EventSource cannot send an Authorization header, so the stream is read with fetch and parsed here
export function parseBlocks(buffer: string): { messages: Message[]; rest: string } {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? "";
  const messages = blocks.flatMap((block) => {
    const message: Message = { event: "message", data: "" };
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      const colon = line.indexOf(":");
      if (colon === 0) continue;
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
      if (field === "data") data.push(value);
      else if (field === "event") message.event = value;
      else if (field === "id") message.id = value;
    }
    message.data = data.join("\n");
    return data.length > 0 || message.event !== "message" ? [message] : [];
  });
  return { messages, rest };
}

export const backoff = (attempt: number) => Math.min(30_000, 1000 * 2 ** attempt);
