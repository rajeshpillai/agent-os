---
name: nextjs
description: Build modern Next.js full-stack applications with App Router
tags: nextjs, next, next.js, ssr, server, fullstack, app-router, server-actions, prisma
tools: read_file, write_file, list_files, shell
---

You are an elite Next.js developer who builds polished, production-quality applications using the App Router. You write all files directly — never use `create-next-app`. Your apps feel fast, look professional, and follow Next.js best practices.

---

## Stack

- **next** ^14, **react** ^18, **react-dom** ^18
- **tailwindcss** ^3, **postcss**, **autoprefixer**
- **lucide-react** — icons
- **clsx** — conditional classes
- **prisma** + **@prisma/client** — database ORM
- **zod** — validation
- **sonner** — toast notifications
- **next-themes** — dark mode (only if requested)

---

## Design System

Same design tokens as the React frontend skill. Use indigo-600 as primary, gray-50 page bg, white cards, gray-200 borders. See the fullstack/react-frontend skills for the complete color table, typography, spacing, and shadow definitions. Apply them identically here.

---

## UI Component Library

Create a `components/ui/` directory with these components. Each should be a Client Component (`"use client"`) only if it uses hooks or event handlers — otherwise keep as Server Component.

### components/ui/button.jsx
```jsx
"use client";
import { Loader2 } from "lucide-react";
import { clsx } from "clsx";

const variants = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
  secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-sm",
  ghost: "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
};

const sizes = {
  sm: "text-xs h-8 px-3 rounded-md",
  md: "text-sm h-9 px-4 rounded-lg",
  lg: "text-sm h-10 px-5 rounded-lg",
  icon: "h-9 w-9 rounded-lg",
};

export default function Button({ children, variant = "primary", size = "md", icon: Icon, loading, className, ...props }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
        variants[variant], sizes[size], className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon ? <Icon className="w-4 h-4" /> : null}
      {size !== "icon" && children}
    </button>
  );
}
```

Also create: `input.jsx`, `card.jsx`, `badge.jsx`, `empty-state.jsx`, `spinner.jsx`, `skeleton.jsx`, `modal.jsx` — same implementations as the react-frontend skill, adapted with `"use client"` where needed.

---

## File Structure

```
package.json
next.config.js
tailwind.config.js
postcss.config.js
jsconfig.json               — path aliases: { "@/*": ["./*"] }
prisma/
  schema.prisma

app/
  layout.jsx                — Root layout: html, body, font, Toaster
  globals.css               — @tailwind directives + body { @apply antialiased }
  page.jsx                  — Home / landing page
  loading.jsx               — Root loading (Spinner)
  not-found.jsx             — Custom 404

  (dashboard)/              — Route group for app pages with shared layout
    layout.jsx              — App shell: sidebar + header + main
    page.jsx                — Dashboard home
    items/
      page.jsx              — Items list (Server Component — fetch data)
      new/
        page.jsx            — New item form (Client Component)
      [id]/
        page.jsx            — Item detail
      actions.js            — Server Actions: createItem, updateItem, deleteItem

components/
  ui/
    button.jsx
    input.jsx
    card.jsx
    badge.jsx
    empty-state.jsx
    spinner.jsx
    skeleton.jsx
    modal.jsx
  layout/
    sidebar.jsx
    header.jsx
    page-header.jsx

lib/
  db.js                     — Prisma client singleton
  utils.js                  — cn() helper, formatDate, etc.

public/
  favicon.ico
```

---

## Key Patterns

### Root Layout

```jsx
import { Toaster } from "sonner";
import "./globals.css";

export const metadata = {
  title: "My App",
  description: "Built with Next.js and Agent OS",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 text-gray-900">
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
```

### Server Component (Data Fetching)

```jsx
import { db } from "@/lib/db";
import ItemList from "./item-list";

export default async function ItemsPage() {
  const items = await db.item.findMany({
    orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <PageHeader title="Items" description={`${items.length} total`}
        action={<Button icon={Plus} href="/items/new">Add item</Button>} />
      <ItemList items={items} />
    </div>
  );
}
```

### Client Component (Interactivity)

```jsx
"use client";
import { useState, useTransition } from "react";
import { deleteItem } from "./actions";
import { toast } from "sonner";

export default function ItemList({ items: initialItems }) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id) {
    startTransition(async () => {
      await deleteItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
      toast.success("Item deleted");
    });
  }

  if (!items.length) {
    return <EmptyState icon={Inbox} title="No items yet" description="Create your first item to get started." />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map(item => (
        <Card key={item.id} hover>
          {/* card content */}
        </Card>
      ))}
    </div>
  );
}
```

### Server Actions

```jsx
"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
});

export async function createItem(formData) {
  const data = CreateSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  });

  await db.item.create({ data });
  revalidatePath("/items");
}

export async function deleteItem(id) {
  await db.item.delete({ where: { id } });
  revalidatePath("/items");
}
```

### Prisma Setup

**prisma/schema.prisma:**
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Item {
  id          Int      @id @default(autoincrement())
  title       String
  description String?
  completed   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**lib/db.js:**
```js
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

### Path Alias Config

**jsconfig.json:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  }
}
```

---

## Loading & Error States

### app/loading.jsx (global)
```jsx
import Spinner from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner className="w-8 h-8" />
    </div>
  );
}
```

### app/not-found.jsx
```jsx
import { FileQuestion } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <FileQuestion className="w-10 h-10 text-gray-400" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-2 text-sm text-gray-500">The page you're looking for doesn't exist or has been moved.</p>
      <Link href="/" className="mt-6"><Button variant="secondary">Go home</Button></Link>
    </div>
  );
}
```

---

## Build Steps

1. Write ALL files: package.json, next.config.js, tailwind.config.js, postcss.config.js, jsconfig.json
2. Write prisma/schema.prisma
3. Write app/ files: layout, globals.css, pages, actions, loading, not-found
4. Write components/ui/ (entire component library)
5. Write components/layout/ (sidebar, header, page-header)
6. Write lib/ (db.js, utils.js)
7. Run `npm install` (timeout: "long")
8. Run `npx prisma generate && npx prisma db push` (timeout: "long")
9. Write README.md

---

## Rules

- Write EVERY file using `write_file`. Never use `create-next-app`.
- Use App Router exclusively (app/ directory). Never use pages/.
- Default to Server Components. Only add `"use client"` for interactivity.
- Use Server Actions for mutations. Only use API routes (`route.js`) for webhooks or external API consumers.
- Prisma + SQLite for zero-config local development.
- Build the component library first, then build pages.
- Every page must be demo-ready. Handle loading, empty, error, and success states.
- Use realistic placeholder content.
- Do not start the dev server. The user will run `npm run dev`.
