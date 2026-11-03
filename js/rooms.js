// Rooms list + room details. Availability is advisory here; the database re-checks atomically at booking time.
const q = new URLSearchParams(location.search);
const iso = d => d.toISOString().slice(0, 10);
const today = iso(new Date());
const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const datesOk = (a, b) => !!a && !!b && a >= today && b > a;

function qs(r, s) {
  return new URLSearchParams({ type: r.id, checkin: s.ci, checkout: s.co, guests: s.g, rooms: s.rm }).toString();
}
async function availability(types, s) {
  const map = {};
  if (!datesOk(s.ci, s.co) || !sb) return map;
  await Promise.all(types.map(async t => {
    const { data, error } = await sb.rpc("available_room_count", { p_type: t.id, p_in: s.ci, p_out: s.co });
    map[t.id] = error ? null : data;
  }));
  return map;
}
function availBadge(n, s) {
  if (n === undefined) return "";
  if (n === null) return '<span class="avail no">Availability unavailable</span>';
  if (n < s.rm) return '<span class="avail no">Not available for your dates</span>';
  return `<span class="avail ok">${n} room${n > 1 ? "s" : ""} available</span>`;
}
function cardHTML(r, s, av) {
  const nights = datesOk(s.ci, s.co) ? nightsBetween(s.ci, s.co) : 0;
  const ok = datesOk(s.ci, s.co) && r.max_guests * s.rm >= s.g && av[r.id] >= s.rm;
  return `<article class="card"><div class="img" role="img" aria-label="${esc(r.name)}" loading="lazy" style="background-image:url('${esc(r.image_url)}'),linear-gradient(135deg,#13213d,#0b1426)"></div>
  <div class="body"><h3>${esc(r.name)}</h3><span class="tag">${esc(r.bed_type)} · ${r.size_sqm} m² · up to ${r.max_guests} guests</span>
  <p>${esc(r.description)}</p>${availBadge(av[r.id], s)}
  <span class="price">${ngn(r.nightly_rate_ngn)} / night <small>(demo price)</small></span>
  ${nights ? `<small>${nights} night${nights > 1 ? "s" : ""}: ${ngn(r.nightly_rate_ngn * nights * s.rm)} before VAT</small>` : ""}
  <div><a class="btn btn-sm btn-line" style="color:inherit" href="room-details.html?slug=${encodeURIComponent(r.slug)}&checkin=${s.ci}&checkout=${s.co}&guests=${s.g}&rooms=${s.rm}">Details</a>
  ${ok ? `<a class="btn btn-sm" href="booking.html?${qs(r, s)}">Book</a>` : ""}</div></div></article>`;
}
const COLS = "id,slug,name,description,bed_type,max_guests,size_sqm,nightly_rate_ngn,amenities,image_url";

async function initList() {
  const list = document.getElementById("list"), $ = id => document.getElementById(id);
  const s = { ci: q.get("checkin") || "", co: q.get("checkout") || "", g: +q.get("guests") || 1, rm: +q.get("rooms") || 1 };
  $("f-ci").min = today; $("f-ci").value = s.ci; $("f-co").value = s.co; $("f-g").value = s.g; $("f-rm").value = s.rm;
  if (!sb) { list.innerHTML = '<div class="state err">Database connection is not configured.</div>'; return; }
  const { data, error } = await sb.from("room_types").select(COLS).eq("is_active", true);
  if (error) { console.error(error); list.innerHTML = '<div class="state err">Could not load rooms. Please try again.<br><small>Details: ' + esc(error.message || error.code || "unknown") + '</small></div>'; return; }
  $("f-cat").insertAdjacentHTML("beforeend", data.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join(""));
  let av = {};
  async function refresh(refetch) {
    s.ci = $("f-ci").value; s.co = $("f-co").value; s.g = +$("f-g").value; s.rm = +$("f-rm").value;
    const msg = $("date-err"); msg.textContent = "";
    if (s.ci || s.co) {
      if (!datesOk(s.ci, s.co)) { msg.textContent = s.ci < today ? "Check-in cannot be in the past." : "Check-out must be after check-in."; }
    }
    if (refetch) av = await availability(data, s);
    const term = $("f-q").value.trim().toLowerCase(), cat = $("f-cat").value;
    let rows = data.filter(r => (!cat || r.id === cat) && r.max_guests * s.rm >= s.g &&
      (!term || (r.name + r.description + r.amenities.join(" ")).toLowerCase().includes(term)));
    const sort = $("f-sort").value;
    rows.sort((a, b) => sort === "high" ? b.nightly_rate_ngn - a.nightly_rate_ngn : sort === "cap" ? b.max_guests - a.max_guests : a.nightly_rate_ngn - b.nightly_rate_ngn);
    list.innerHTML = rows.length ? rows.map(r => cardHTML(r, s, av)).join("") : '<div class="state">No rooms match your filters.</div>';
  }
  ["f-q", "f-cat", "f-g", "f-sort"].forEach(id => $(id).addEventListener("input", () => refresh(false)));
  ["f-ci", "f-co", "f-rm"].forEach(id => $(id).addEventListener("change", () => refresh(true)));
  refresh(true);
}

async function initDetail() {
  const box = document.getElementById("detail");
  const s = { ci: q.get("checkin") || "", co: q.get("checkout") || "", g: +q.get("guests") || 1, rm: +q.get("rooms") || 1 };
  if (!sb) { box.innerHTML = '<div class="state err">Database connection is not configured.</div>'; return; }
  const { data, error } = await sb.from("room_types").select(COLS).eq("is_active", true);
  if (error) { box.innerHTML = '<div class="state err">Could not load this room.</div>'; return; }
  const r = data.find(x => x.slug === q.get("slug"));
  if (!r) { box.innerHTML = '<div class="state">Room not found. <a href="rooms.html">Browse rooms</a></div>'; return; }
  document.title = r.name + " — AURELIA HOTELS";
  box.innerHTML = `<div class="hero-img" role="img" aria-label="${esc(r.name)} photograph" style="background-image:url('${esc(r.image_url)}'),linear-gradient(135deg,#13213d,#0b1426)"></div>
  <div><p class="eyebrow">${esc(r.bed_type)} · ${r.size_sqm} m² · up to ${r.max_guests} guests</p><h1>${esc(r.name)}</h1><p>${esc(r.description)}</p>
  <ul class="chips">${r.amenities.map(a => `<li>${esc(a)}</li>`).join("")}</ul>
  <p class="price" style="font-size:1.4rem">${ngn(r.nightly_rate_ngn)} <small>/ night · demo price</small></p>
  <div class="grid" style="grid-template-columns:1fr 1fr"><div><label for="d-ci">Check-in</label><input id="d-ci" type="date" min="${today}" value="${esc(s.ci)}"></div>
  <div><label for="d-co">Check-out</label><input id="d-co" type="date" value="${esc(s.co)}"></div>
  <div><label for="d-g">Guests</label><input id="d-g" type="number" min="1" max="${r.max_guests * 5}" value="${s.g}"></div>
  <div><label for="d-rm">Rooms</label><input id="d-rm" type="number" min="1" max="5" value="${s.rm}"></div></div>
  <p id="d-msg" role="status" class="avail"></p><a id="d-book" class="btn" href="#" aria-disabled="true">Check availability</a></div>`;
  const $ = id => document.getElementById(id);
  async function check() {
    const v = { ci: $("d-ci").value, co: $("d-co").value, g: +$("d-g").value, rm: +$("d-rm").value }, m = $("d-msg"), b = $("d-book");
    b.removeAttribute("href"); b.setAttribute("aria-disabled", "true"); m.className = "avail no";
    if (!datesOk(v.ci, v.co)) { m.textContent = v.ci && v.ci < today ? "Check-in cannot be in the past." : "Choose valid dates (check-out after check-in)."; return; }
    if (v.rm < 1 || v.rm > 5 || v.g < 1 || v.g > r.max_guests * v.rm) { m.textContent = `This room sleeps up to ${r.max_guests} guests per room.`; return; }
    const { data: n, error: e } = await sb.rpc("available_room_count", { p_type: r.id, p_in: v.ci, p_out: v.co });
    if (e) { m.textContent = "Could not check availability. Please try again."; return; }
    if (n < v.rm) { m.textContent = "Not available for those dates."; return; }
    const nights = nightsBetween(v.ci, v.co);
    m.className = "avail ok"; m.textContent = `${n} available · ${nights} night(s) · ${ngn(r.nightly_rate_ngn * nights * v.rm)} before VAT`;
    b.textContent = "Book this room"; b.setAttribute("aria-disabled", "false");
    b.href = `booking.html?${qs(r, v)}`;
  }
  ["d-ci", "d-co", "d-g", "d-rm"].forEach(id => $(id).addEventListener("change", check));
  $("d-book").addEventListener("click", e => { if ($("d-book").getAttribute("aria-disabled") === "true") { e.preventDefault(); check(); } });
  if (datesOk(s.ci, s.co)) check();
  const rel = data.filter(x => x.id !== r.id).slice(0, 3), box2 = document.getElementById("related");
  box2.innerHTML = rel.map(x => `<article class="card"><div class="img" style="background-image:url('${esc(x.image_url)}'),linear-gradient(135deg,#13213d,#0b1426)"></div><div class="body"><h3>${esc(x.name)}</h3><span class="price">${ngn(x.nightly_rate_ngn)} / night</span><a class="btn btn-sm" href="room-details.html?slug=${encodeURIComponent(x.slug)}">View</a></div></article>`).join("");
}
addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("list")) initList();
  if (document.getElementById("detail")) initDetail();
});
