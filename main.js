// Shared layout (single source of truth for nav/footer) + helpers. All paths are relative for GitHub Pages.
const NAV = [["index.html","Home"],["rooms.html","Rooms"],["dining.html","Dining"],["facilities.html","Facilities"],["gallery.html","Gallery"],["offers.html","Offers"],["about.html","About"],["contact.html","Contact"]];
window.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
window.ngn = n => "₦" + Number(n).toLocaleString("en-NG", { maximumFractionDigits: 0 });

document.addEventListener("DOMContentLoaded", () => {
  const here = location.pathname.split("/").pop() || "index.html";
  const links = NAV.map(([h, t]) => `<a href="${h}"${h === here ? ' aria-current="page"' : ""}>${t}</a>`).join("");
  document.body.insertAdjacentHTML("afterbegin",
    `<div class="demo-bar">Fictional demonstration hotel — portfolio project. No real bookings or payments.</div>
     <header class="site-header"><div class="wrap nav">
       <a class="brand" href="index.html">AURELIA<span>HOTELS</span></a>
       <button class="menu-btn" aria-expanded="false" aria-controls="nav-links" aria-label="Menu">☰</button>
       <nav id="nav-links" class="nav-links">${links}<a class="btn btn-sm" href="booking.html">Book Now</a><a href="login.html">Sign in</a></nav>
     </div></header>`);
  document.body.insertAdjacentHTML("beforeend",
    `<footer class="site-footer"><div class="wrap foot">
       <div><a class="brand" href="index.html">AURELIA<span>HOTELS</span></a><p>A fictional luxury hotel brand created for a software portfolio. Not a real property.</p></div>
       <div><h4>Explore</h4>${links}</div>
       <div><h4>Guests</h4><a href="login.html">Sign in</a><a href="register.html">Register</a><a href="my-bookings.html">My bookings</a><a href="privacy.html">Privacy</a></div>
       <div><h4>Contact</h4><p>12 Demo Avenue, Victoria Island, Lagos (fictional)<br>+234 000 000 0000 (demo)</p></div>
     </div><p class="copy">© 2026 AURELIA HOTELS · Designed &amp; Developed by Ahmad</p></footer>`);
  const btn = document.querySelector(".menu-btn"), nav = document.getElementById("nav-links");
  btn.addEventListener("click", () => btn.setAttribute("aria-expanded", nav.classList.toggle("open")));
});
