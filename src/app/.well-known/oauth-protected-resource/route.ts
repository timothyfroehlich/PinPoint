import {
  getMcpAuthorizationServerUrl,
  getMcpResourceUrl,
} from "~/lib/mcp/config";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

export function GET(_request: Request): Response {
  return Response.json(
    {
      resource: getMcpResourceUrl(),
      authorization_servers: [getMcpAuthorizationServerUrl()],
    },
    {
      headers: {
        ...corsHeaders,
        "Cache-Control": "max-age=3600",
      },
    }
  );
}

export function OPTIONS(): Response {
  return new Response(null, { status: 200, headers: corsHeaders });
}
