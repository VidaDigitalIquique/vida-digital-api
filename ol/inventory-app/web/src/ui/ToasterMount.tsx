import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Toaster } from "react-hot-toast";

export default function ToasterMount() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const div = document.createElement("div");
    div.id = "toaster-root";
    document.body.appendChild(div);
    setEl(div);
    return () => { div.remove(); };
  }, []);
  if (!el) return null;
  return createPortal(<Toaster position="top-center" />, el);
}