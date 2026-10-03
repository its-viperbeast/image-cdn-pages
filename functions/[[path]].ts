import { handlePagesRequest } from "../src/lib/transform";

interface Env {
  ALLOWED_HOSTS?: string;
  [key: string]: unknown;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  // If the request contains ?url=..., process image transformation
  if (url.searchParams.has("url")) {
    return handlePagesRequest(context.request, context.env);
  }

  // Otherwise, fall through to static assets (playground UI, static files, etc.)
  return await context.next();
};
