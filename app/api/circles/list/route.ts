import { NextResponse } from "next/server";
import { getAllCircles } from "@/lib/store";

/**
 * GET /api/circles/list
 * 
 * Returns a list of all circles with preview data.
 * Shows all circles (managed demos + open user circles).
 */
export async function GET() {
  try {
    const allCircles = await getAllCircles();
    
    // Transform to preview format
    const circles = allCircles.map((circle) => {
      // For open circles: count members array length
      // For managed circles: use memberCount directly
      const filled = circle.kind === "open" && circle.members 
        ? circle.members.length 
        : circle.memberCount;
      
      // Map phase to user-friendly status
      let status: "lobby" | "active" | "completed";
      if (circle.phase === "forming" || circle.phase === "bonded") {
        status = "lobby";
      } else if (circle.phase === "complete") {
        status = "completed";
      } else {
        status = "active";
      }
      
      return {
        id: circle.id,
        title: circle.title || `${circle.memberCount}-Member Circle`,
        capacity: circle.capacity || circle.memberCount,
        filled,
        contribution: circle.contribution,
        status,
        createdAt: circle.updatedAt,
      };
    });

    // Sort: lobby first, then active, then completed
    circles.sort((a, b) => {
      const statusOrder = { lobby: 0, active: 1, completed: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    });

    return NextResponse.json({ circles });
  } catch (error) {
    console.error("Failed to list circles:", error);
    return NextResponse.json(
      { error: "Failed to load circles" },
      { status: 500 }
    );
  }
}
