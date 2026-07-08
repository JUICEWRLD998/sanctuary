import { NextRequest, NextResponse } from "next/server";
import { getAllCircles } from "@/lib/store";

/**
 * GET /api/user/circles?address=ST...
 * 
 * Returns all circles where the given address is a member.
 * Used for "My Circles" dashboard.
 * Only works for open circles (with members array).
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  
  if (!address) {
    return NextResponse.json(
      { error: "Address parameter required" },
      { status: 400 }
    );
  }

  try {
    const allCircles = await getAllCircles();
    
    // Filter circles where the user is a member
    // Only open circles have a members array
    const userCircles = allCircles
      .filter((circle) => {
        // Only process open circles with members
        if (circle.kind !== "open" || !circle.members) {
          return false;
        }
        // Check if this address is in the members array
        return circle.members.some((m) => m.address === address);
      })
      .map((circle) => {
        const members = circle.members!; // Safe because we filtered above
        const memberIndex = members.findIndex((m) => m.address === address);
        
        // Determine if this user is receiving the payout this round
        const isMyTurn = circle.payoutOrder[circle.currentRound] === memberIndex;
        
        return {
          id: circle.id,
          title: circle.title || "Untitled Circle",
          capacity: circle.capacity || circle.memberCount,
          myPosition: memberIndex + 1,
          contribution: circle.contribution,
          phase: circle.phase,
          currentRound: circle.currentRound,
          totalRounds: circle.capacity || circle.memberCount,
          // Calculate next payout date if it's this user's turn
          nextPayoutDate: isMyTurn 
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() 
            : undefined,
        };
      });

    return NextResponse.json({ circles: userCircles });
  } catch (error) {
    console.error("Failed to load user circles:", error);
    return NextResponse.json(
      { error: "Failed to load circles" },
      { status: 500 }
    );
  }
}
