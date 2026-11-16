import { cn } from "cn";
import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const REMARK_PLUGINS = [remarkGfm];

const COMPONENTS: Components = {
  p: ({ node: _node, className, ...props }) => (
    <p className={cn("type-body wrap-anywhere not-first:mt-2", className)} {...props} />
  ),
  h1: ({ node: _node, className, ...props }) => (
    <h1 className={cn("type-title mt-3 first:mt-0 text-foreground", className)} {...props} />
  ),
  h2: ({ node: _node, className, ...props }) => (
    <h2 className={cn("type-title mt-3 first:mt-0 text-foreground", className)} {...props} />
  ),
  h3: ({ node: _node, className, ...props }) => (
    <h3 className={cn("type-body mt-2.5 font-semibold first:mt-0 text-foreground", className)} {...props} />
  ),
  h4: ({ node: _node, className, ...props }) => (
    <h4 className={cn("type-body mt-2 font-semibold first:mt-0 text-foreground", className)} {...props} />
  ),
  ul: ({ node: _node, className, ...props }) => (
    <ul className={cn("type-body my-1.5 list-disc space-y-1 pl-5", className)} {...props} />
  ),
  ol: ({ node: _node, className, ...props }) => (
    <ol className={cn("type-body my-1.5 list-decimal space-y-1 pl-5", className)} {...props} />
  ),
  li: ({ node: _node, className, ...props }) => <li className={cn("wrap-anywhere", className)} {...props} />,
  blockquote: ({ node: _node, className, ...props }) => (
    <blockquote className={cn("my-2 border-l-2 border-border pl-3 text-muted-foreground", className)} {...props} />
  ),
  a: ({ node: _node, className, ...props }) => (
    <a
      className={cn("text-link underline underline-offset-2 hover:opacity-80", className)}
      target="_blank"
      rel="noreferrer noopener"
      {...props}
    />
  ),
  hr: ({ node: _node }) => <Separator className="my-2" />,
  pre: ({ node: _node, className, ...props }) => (
    <pre
      className={cn(
        "type-caption my-2 overflow-x-auto border border-border bg-muted/60 p-2.5 font-mono [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0",
        className,
      )}
      {...props}
    />
  ),
  code: ({ node: _node, className, ...props }) => (
    <code
      className={cn("type-caption border border-border/60 bg-muted/70 px-1 py-0.5 font-mono", className)}
      {...props}
    />
  ),
  table: ({ node: _node, className, ...props }) => (
    <div className="my-2 border border-border">
      <Table className={cn("type-caption", className)} {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }) => <TableHeader {...props} />,
  tbody: ({ node: _node, ...props }) => <TableBody {...props} />,
  tr: ({ node: _node, ...props }) => <TableRow {...props} />,
  th: ({ node: _node, className, ...props }) => (
    <TableHead
      className={cn("type-micro h-auto px-2 py-1.5 tracking-normal whitespace-normal normal-case", className)}
      {...props}
    />
  ),
  td: ({ node: _node, className, ...props }) => (
    <TableCell
      className={cn("type-caption px-2 py-1.5 align-top whitespace-normal wrap-anywhere", className)}
      {...props}
    />
  ),
};

// why: panels re-render on every streamed frame, and re-parsing unchanged markdown dominated those renders
export const MarkdownText = memo(function MarkdownText({ text }: { text: string }) {
  return (
    <div className="min-w-0">
      <Markdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
        {text}
      </Markdown>
    </div>
  );
});
