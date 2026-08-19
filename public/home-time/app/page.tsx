import HomeBoard from "../components/HomeBoard";

export default function Home() {
  return <HomeBoard initialNow={new Date().toISOString()} />;
}
