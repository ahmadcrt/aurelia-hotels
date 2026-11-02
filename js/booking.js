// Checkout. Totals shown here are a PREVIEW; the database function recalculates and stores the authoritative total.
const q = new URLSearchParams(location.search), $ = id => document.getElementById(id);
const today = new Date().toISOString().slice(0, 10);
const P = { type: q.get("type"), ci: q.get("checkin"), co: q.get("checkout"), g: +q.get("guests"), rm: +q.get("rooms") };
const VAT = 0.075;
function fail(msg) { $("checkout").innerHTML = `<div class="panel state err" role="alert">${esc(msg)} <a href="rooms.html">Back to rooms</a></div>`; }

async function init() {
  if (!sb) return fail("Database connection is not configured.");
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = "login.html?next=" + encodeURIComponent("booking.html" + location.search); return; }
  if (!P.type || !P.ci || !P.co) return fail("Missing booking details.");
  if (P.ci < today) return fail("Check-in cannot be in the past.");
  if (P.co <= P.ci) return fail("Check-out must be after check-in.");
  if (!(P.rm >= 1 && P.rm <= 5) || !(P.g >= 1)) return fail("Invalid guests or rooms.");
  const { data: r, error } = await sb.from("room_types").select("id,name,nightly_rate_ngn,max_guests,bed_type").eq("id", P.type).eq("is_active", true).single();
  if (error || !r) return fail("This room is no longer available.");
  if (P.g > r.max_guests * P.rm) return fail(`Maximum ${r.max_guests * P.rm} guests for ${P.rm} room(s).`);
  const nights = Math.round((new Date(P.co) - new Date(P.ci)) / 864e5);
  const sub = r.nightly_rate_ngn * nights * P.rm, vat = Math.round(sub * VAT * 100) / 100;
  $("summary").innerHTML = `<h3>${esc(r.name)}</h3>
    <div class="row"><span>Check-in</span><span>${esc(P.ci)}</span></div><div class="row"><span>Check-out</span><span>${esc(P.co)}</span></div>
    <div class="row"><span>Guests / rooms</span><span>${P.g} / ${P.rm}</span></div>
    <div class="row"><span>${ngn(r.nightly_rate_ngn)} × ${nights} night(s) × ${P.rm}</span><span>${ngn(sub)}</span></div>
    <div class="row"><span>VAT (7.5%)</span><span>${ngn(vat)}</span></div>
    <div class="row total"><span>Estimated total</span><span>${ngn(sub + vat)}</span></div>
    <p class="notice">Demonstration prices. <strong>No payment is taken</strong> — payment is simulated only; real payments would need a licensed payment provider and a secure backend.</p>`;
  const { data: prof } = await sb.from("profiles").select("full_name,phone").eq("id", session.user.id).maybeSingle();
  $("name").value = prof?.full_name || ""; $("phone").value = prof?.phone || ""; $("email").value = session.user.email;

  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("name").value.trim(), phone = $("phone").value.trim(), msg = $("form-msg"), btn = $("submit");
    msg.className = "err"; msg.textContent = "";
    if (name.length < 2) { msg.textContent = "Please enter your full name."; return; }
    if (phone && !/^[+\d][\d\s-]{6,19}$/.test(phone)) { msg.textContent = "Enter a valid phone number or leave it blank."; return; }
    if (!$("terms").checked) { msg.textContent = "Please accept the cancellation policy."; return; }
    btn.disabled = true; btn.textContent = "Reserving…";
    await sb.from("profiles").update({ full_name: name, phone: phone || null }).eq("id", session.user.id);
    const { data, error: err } = await sb.rpc("create_reservation", { p_type: P.type, p_in: P.ci, p_out: P.co, p_guests: P.g, p_rooms: P.rm, p_requests: $("requests").value.trim() || null });
    btn.disabled = false; btn.textContent = "Confirm reservation (demo)";
    if (err || !data || !data[0]) { msg.textContent = err ? err.message : "Reservation could not be created."; return; }
    $("checkout").innerHTML = `<div class="ok-box" role="status"><h2>Reservation received</h2><p>Your booking reference:</p><p class="ref">${esc(data[0].reference)}</p>
      <p>Estimated total: <strong>${ngn(data[0].total_ngn)}</strong> (demo — nothing was charged). Status: <strong>Pending</strong> until confirmed by an administrator.</p>
      <a class="btn" href="my-bookings.html">View my bookings</a></div>`;
  });
}
addEventListener("DOMContentLoaded", init);
