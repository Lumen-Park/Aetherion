import { useEffect, useState } from "react";
import { localMoment } from "../lib/experience";

export default function useLocalMoment() {
  const [moment, setMoment] = useState(() =>
    localMoment(new Date(), navigator.language),
  );
  useEffect(() => {
    const update = () => {
      if (!document.hidden)
        setMoment(localMoment(new Date(), navigator.language));
    };
    const timer = setInterval(update, 30_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return moment;
}
