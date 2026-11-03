(function(){
// Guest dashboard / my bookings. RLS guarantees only the signed-in guest's own rows are returned.
const $ = id => document.getElementById(id);
const LABEL = { pending: "Pending", confirmed: "Confirmed", checked_in: "Checked in", checked_out: "Checked out", cancelled: "Cancelled" };
const iso = d => d.toISOString().slice(0, 10), today = iso(new Date()), in2 = iso(new Date(Date.now() + 2 * 864e5));

function card(r) {
  const canCancel = ["pending", "confirmed"].includes(r.status) && r.check_in >= in2;
  return `<article class="res"><header><strong class="ref" style="font-size:1.1rem">${esc(r.reference)}</strong><span class="badge ${esc(r.status)}">${LABEL[r.status] || esc(r.status)}</span></header>
  <dl><div><dt>Room</dt><dd>${esc(r.room_types?.name || "—")}</dd></div><div><dt>Check-in</dt><dd>${esc(r.check_in)}</dd></div><div><dt>Check-out</dt><dd>${esc(r.check_out)}</dd></div>
  <div><dt>Guests / rooms</dt><dd>${r.guests} / ${r.room_count}</dd></div><div><dt>Est. total</dt><dd>${ngn(r.total_ngn)}</dd></div></dl>
  <details><summary>Price breakdown</summary><div class="row"><span>${ngn(r.nightly_rate_ngn)} × ${r.nights} night(s) × ${r.room_count}</span><span>${ngn(r.subtotal_ngn)}</span></div>
  <div class="row"><span>VAT (7.5%)</span><span>${ngn(r.vat_ngn)}</span></div><div class="row"><strong>Estimated total (demo, nothing charged)</strong><strong>${ngn(r.total_ngn)}</strong></div></details>
  ${canCancel ? `<p><button class="btn btn-sm btn-line" style="color:inherit" data-cancel="${esc(r.id)}">Cancel reservation</button></p>` : ""}</article>`;
}
async function load(session) {
  const { data, error } = await sb.from("reservations")
    .select("id,reference,check_in,check_out,guests,room_count,nights,nightly_rate_ngn,subtotal_ngn,vat_ngn,total_ngn,status,room_types(name)")
    .order("check_in", { ascending: false });
  if (error) { $("lists").innerHTML = '<div class="state err">Could not load your reservations. Please try again.</div>'; return; }
  const cancelled = data.filter(r => r.status === "cancelled");
  const upcoming = data.filter(r => r.status !== "cancelled" && r.check_out >= today && r.status !== "checked_out");
  const past = data.filter(r => r.status !== "cancelled" && !upcoming.includes(r));
  if ($("stats")) $("stats").innerHTML = [["Upcoming", upcoming.length], ["Past", past.length], ["Cancelled", cancelled.length], ["Total", data.length]].map(([k, v]) => `<div class="stat"><b>${v}</b>${k}</div>`).join("");
  const sec = (t, a) => `<h2 style="font-size:1.6rem;margin-top:28px">${t}</h2>` + (a.length ? a.map(card).join("") : '<div class="state">None.</div>');
  $("lists").innerHTML = sec("Upcoming", upcoming) + sec("Past", past) + sec("Cancelled", cancelled);
}
addEventListener("DOMContentLoaded", async () => {
  const session = await requireAuth(); if (!session) return;
  const { data: p } = await sb.from("profiles").select("full_name").eq("id", session.user.id).maybeSingle();
  if ($("welcome")) $("welcome").textContent = "Welcome, " + ((p && p.full_name) || session.user.email);
  $("signout").addEventListener("click", signOut);
  $("lists").addEventListener("click", async e => {
    const id = e.target.dataset.cancel; if (!id) return;
    if (!confirm("Cancel this reservation? Free cancellation applies up to 48 hours before check-in.")) return;
    e.target.disabled = true;
    const { error } = await sb.rpc("cancel_reservation", { p_id: id });
    if (error) { alert(error.message); e.target.disabled = false; return; }
    load(session);
  });
  load(session);
});
})();
