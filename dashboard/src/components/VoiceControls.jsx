import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { IconButton } from "./WorkspaceParts";

export default function VoiceControls({ onTranscript, text = "", onNotice }) {
  const recognition = useRef(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(
    () => () => {
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  const listen = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      onNotice(
        "Voice input is not supported in this browser. You can still type your message.",
      );
      return;
    }
    const session = new Recognition();
    recognition.current = session;
    session.lang = navigator.language || "en-US";
    session.interimResults = false;
    session.onstart = () => setListening(true);
    session.onend = () => setListening(false);
    session.onerror = (event) => {
      setListening(false);
      onNotice(
        event.error === "not-allowed"
          ? "Microphone permission was denied. Enable it in browser settings to dictate."
          : "Dictation stopped. Please try again or type your message.",
      );
    };
    session.onresult = (event) => {
      const transcript = Array.from(event.results)
        .filter((r) => r.isFinal)
        .map((r) => r[0].transcript)
        .join(" ");
      if (transcript) onTranscript(transcript);
    };
    onNotice(
      "Dictation uses your browser’s speech service, which may process audio online. Review the transcript before sending.",
    );
    try {
      session.start();
    } catch {
      onNotice("Microphone could not start. Please retry.");
    }
  };
  const speak = () => {
    if (!window.speechSynthesis) {
      onNotice("Read aloud is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    if (speaking) {
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 20000));
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };
  return (
    <>
      <IconButton
        label={listening ? "Stop dictation" : "Dictate message"}
        aria-pressed={listening}
        onClick={listen}
      >
        {listening ? <MicOff size={18} /> : <Mic size={18} />}
      </IconButton>
      <IconButton
        label={speaking ? "Stop reading aloud" : "Read latest answer aloud"}
        disabled={!text}
        aria-pressed={speaking}
        onClick={speak}
      >
        {speaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </IconButton>
      <span className="aw-sr-only" role="status">
        {listening
          ? "Listening. Your transcript will appear in the composer."
          : speaking
            ? "Reading answer aloud."
            : ""}
      </span>
    </>
  );
}
