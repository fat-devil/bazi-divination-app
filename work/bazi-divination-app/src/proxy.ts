import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";

  if (!host.startsWith("127.0.0.1")) {
    return NextResponse.next();
  }

  const port = host.split(":")[1];
  const url = new URL(request.nextUrl.pathname + request.nextUrl.search, `http://localhost${port ? `:${port}` : ""}`);

  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: url.toString(),
    },
  });
}
