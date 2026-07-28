import type { Metadata } from "next";
import { LumiClimbGame } from "./LumiClimbGame";

export const metadata: Metadata = {
  title: "STARBOUND STEPS",
  description: "별빛 여행자 루미와 함께 끝없이 하늘을 향해 오르는 캐주얼 웹게임",
};

export default function Home() {
  return <LumiClimbGame />;
}
