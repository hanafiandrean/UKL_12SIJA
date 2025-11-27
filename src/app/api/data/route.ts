import { NextResponse } from "next/server";

let latestData: any = null;

export async function POST(req: Request) {
  const data = await req.json();
  latestData = data;
  console.log("Data received:", data);
  return NextResponse.json({ message: "OK" });
}

export async function GET() {
  if (!latestData) {
    return NextResponse.json({ message: "No data yet" });
  }
  return NextResponse.json(latestData);
}
