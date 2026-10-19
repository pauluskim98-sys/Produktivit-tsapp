import {
  lookupPlaces,
  proposalFromPlace,
  researchAddresses,
  lookupNamedPlaces,
} from "@/lib/place-search";
import { sameOrigin, errorResponse } from "@/lib/validation";
import { getLife } from "@/lib/life";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { queries, autocomplete } = await request.json();
    if (
      !Array.isArray(queries) ||
      !queries.length ||
      queries.length > 3 ||
      queries.some((q) => typeof q !== "string" || !q.trim() || q.length > 300)
    )
      throw new Error("Bitte einen Ort oder Namen angeben.");
    const found = new Map();
    if (autocomplete === true) {
      try {
        for (const p of await lookupNamedPlaces(queries[0], getLife().city)) {
          const proposal = proposalFromPlace(p);
          if (proposal)
            found.set(`${proposal.name}:${proposal.address}`, proposal);
        }
      } catch {}
      if (!found.size) {
        try {
          for (const p of await lookupPlaces(
            `${queries[0]}, ${getLife().city}`,
          )) {
            const proposal = proposalFromPlace(p);
            if (proposal) found.set(proposal.address, proposal);
          }
        } catch {}
      }
      return Response.json(
        { proposals: [...found.values()].slice(0, 5) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    for (const q of queries) {
      try {
        for (const p of await lookupPlaces(q)) {
          const proposal = proposalFromPlace(p);
          if (proposal) found.set(proposal.address, proposal);
        }
      } catch {}

      if (!found.size) {
        try {
          for (const p of await researchAddresses(q)) found.set(p.address, p);
        } catch {}
      }
      if (found.size) break;
    }
    return Response.json(
      { proposals: [...found.values()].slice(0, 5) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
