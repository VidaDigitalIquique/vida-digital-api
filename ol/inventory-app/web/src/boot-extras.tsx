import * as React from "react";

/** Corrige mojibake tÃ­pico por doble codificaciÃ³n (UTF-8 leÃ­do como Latin-1). */
function replaceMojibake(s: string): string {
  const pairs: Array<[RegExp, string]> = [
    // Palabras completas frecuentes en tu UI
    [/UbicaciÃƒÂ³n Bodega/g, "UbicaciÃ³n Bodega"],
    [/Cajas \(teÃƒÂ³rico\)/g, "Cajas (teÃ³rico)"],
    [/Buscar por cÃƒÂ³digo o descripciÃƒÂ³n/g, "Buscar por cÃ³digo o descripciÃ³n"],
    [/PÃƒÂ¡gina/g, "PÃ¡gina"],

    // TÃ­tulos de columnas / labels genÃ©ricos
    [/CÃƒÂ³digo/g, "CÃ³digo"],
    [/DescripciÃƒÂ³n/g, "DescripciÃ³n"],
    [/TeÃƒÂ³rico/g, "TeÃ³rico"],
    [/FÃƒÂ­sico/g, "FÃ­sico"],
    [/Unid\/Caja/g, "Unid/Caja"],

    // ReparaciÃ³n general de caracteres
    [/ÃƒÂ¡/g, "Ã¡"], [/ÃƒÂ©/g, "Ã©"], [/ÃƒÂ­/g, "Ã­"], [/ÃƒÂ³/g, "Ã³"], [/ÃƒÂº/g, "Ãº"],
    [/ÃƒÂ/g, "Ã"], [/Ãƒâ€°/g, "Ã‰"], [/ÃƒÂ/g, "Ã"], [/Ãƒâ€œ/g, "Ã“"], [/ÃƒÅ¡/g, "Ãš"],
    [/ÃƒÂ±/g, "Ã±"], [/Ãƒâ€˜/g, "Ã‘"], [/ÃƒÂ¼/g, "Ã¼"], [/ÃƒÅ“/g, "Ãœ"], [/ÃƒÂ§/g, "Ã§"],
    [/Ã‚Â¿/g, "Â¿"], [/Ã‚Â¡/g, "Â¡"], [/Ã‚Âº/g, "Âº"], [/Ã‚Â°/g, "Â°"], [/Ã‚Âª/g, "Âª"],
    [/Ã¢â‚¬â€œ/g, "â€“"], [/Ã¢â‚¬â€/g, "â€”"], [/Ã¢â‚¬Â¦/g, "â€¦"], [/Ã¢â‚¬Å“/g, "â€œ"], [/Ã¢â‚¬Â/g, "â€"],
    [/Ã¢â‚¬Ëœ/g, "â€˜"], [/Ã¢â‚¬â„¢/g, "â€™"],
  ];
  let out = s;
  for (const [re, to] of pairs) out = out.replace(re, to);
  return out;
}

function walkAndFix(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const toFix: Text[] = [];
  while (walker.nextNode()) {
    const t = walker.currentNode as Text;
    const src = t.nodeValue ?? "";
    const fixed = replaceMojibake(src);
    if (fixed !== src) toFix.push(t);
  }
  for (const t of toFix) t.nodeValue = replaceMojibake(t.nodeValue ?? "");

  // Atributos visibles
  root.querySelectorAll<HTMLElement>("input[placeholder],*[title]").forEach(el => {
    const inEl = el as HTMLInputElement;
    if (inEl.placeholder) inEl.placeholder = replaceMojibake(inEl.placeholder);
    const ttl = el.getAttribute("title");
    if (ttl) el.setAttribute("title", replaceMojibake(ttl));
  });
}

export default function BootExtras() {
  React.useEffect(() => {
    try {
      const root = document.getElementById("root");
      if (!root) return;

      // Fix inicial
      walkAndFix(root);

      // Observa nuevos nodos / cambios de texto y los repara
      const obs = new MutationObserver(muts => {
        for (const m of muts) {
          if (m.type === "childList") {
            m.addedNodes.forEach(n => {
              if (n.nodeType === 1) walkAndFix(n as Element);
            });
          } else if (m.type === "characterData") {
            const cd = m.target as CharacterData;
            const fixed = replaceMojibake(cd.data);
            if (fixed !== cd.data) cd.data = fixed;
          }
        }
      });
      obs.observe(root, { childList: true, subtree: true, characterData: true });
      return () => obs.disconnect();
    } catch (err) {
      // Nunca romper la app por esto
      console.error("BootExtras error:", err);
    }
  }, []);

  return null; // componente â€œfantasmaâ€
}
export {};
