(function(){
  try {
    if (document.getElementById("vd-report-fab")) return;
    var a = document.createElement("a");
    a.id = "vd-report-fab";
    a.href = "/reports";
    a.textContent = "Reportes (beta)";
    a.style.position="fixed";
    a.style.right="18px";
    a.style.bottom="18px";
    a.style.zIndex="9999";
    a.style.background="#111827";
    a.style.color="white";
    a.style.padding="10px 14px";
    a.style.borderRadius="9999px";
    a.style.boxShadow="0 6px 18px rgba(0,0,0,.2)";
    a.style.fontSize="14px";
    a.style.textDecoration="none";
    document.body.appendChild(a);
  } catch (e) { /* ignore */ }
})();
