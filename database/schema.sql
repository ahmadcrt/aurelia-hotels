-- AURELIA HOTELS (fictional demo) — schema.sql  | Run FIRST in Supabase SQL Editor
create extension if not exists btree_gist;

create type reservation_status as enum ('pending','confirmed','checked_in','checked_out','cancelled');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  role text not null default 'guest' check (role in ('guest','admin')),
  created_at timestamptz not null default now()
);

create table room_types (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  bed_type text not null,
  max_guests int not null check (max_guests between 1 and 10),
  size_sqm int not null check (size_sqm > 0),
  nightly_rate_ngn numeric(12,2) not null check (nightly_rate_ngn > 0),
  amenities text[] not null default '{}',
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references room_types(id) on delete restrict,
  room_number text unique not null,
  status text not null default 'available' check (status in ('available','out_of_service'))
);
create index on rooms(room_type_id);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  guest_id uuid not null references profiles(id) on delete restrict,
  room_type_id uuid not null references room_types(id),
  check_in date not null,
  check_out date not null,
  guests int not null check (guests > 0),
  room_count int not null check (room_count between 1 and 5),
  nightly_rate_ngn numeric(12,2) not null,       -- price SNAPSHOT: later rate changes never alter this booking
  nights int not null check (nights > 0),
  subtotal_ngn numeric(14,2) not null,
  vat_ngn numeric(14,2) not null,                -- 7.5% VAT (demo)
  total_ngn numeric(14,2) not null,              -- ESTIMATE only; no payment is collected
  status reservation_status not null default 'pending',
  special_requests text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (check_out > check_in)
);
create index on reservations(guest_id);
create index on reservations(status, check_in);

-- One row per physical room per reservation. The EXCLUDE constraint makes
-- double-booking a physical room impossible even under concurrent requests.
create table reservation_rooms (
  reservation_id uuid not null references reservations(id) on delete cascade,
  room_id uuid not null references rooms(id),
  stay daterange not null,
  active boolean not null default true,
  primary key (reservation_id, room_id),
  exclude using gist (room_id with =, stay with &&) where (active)
);

create table status_history (
  id bigserial primary key,
  reservation_id uuid not null references reservations(id) on delete cascade,
  old_status reservation_status, new_status reservation_status not null,
  changed_by uuid, changed_at timestamptz not null default now()
);

create table contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message text not null check (char_length(message) between 5 and 2000),
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;  -- role is ALWAYS 'guest' here; client metadata is ignored
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- availability (inventory by physical room) ----------
create or replace function available_room_count(p_type uuid, p_in date, p_out date)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from rooms r
  where r.room_type_id = p_type and r.status = 'available'
    and not exists (select 1 from reservation_rooms rr
                    where rr.room_id = r.id and rr.active
                      and rr.stay && daterange(p_in, p_out, '[)'))
$$;

-- ---------- booking (transactional, authorised) ----------
create or replace function create_reservation(
  p_type uuid, p_in date, p_out date, p_guests int, p_rooms int, p_requests text default null)
returns table (reservation_id uuid, reference text, total_ngn numeric)
language plpgsql security definer set search_path = public as $$
declare t room_types; n int; sub numeric; vat numeric; rid uuid; ref text; picked uuid[];
begin
  if auth.uid() is null then raise exception 'Please sign in to book.'; end if;
  if p_in < current_date then raise exception 'Check-in cannot be in the past.'; end if;
  if p_out <= p_in then raise exception 'Check-out must be after check-in.'; end if;
  if p_rooms < 1 or p_rooms > 5 then raise exception 'Invalid number of rooms.'; end if;
  select * into t from room_types where id = p_type and is_active;
  if not found then raise exception 'Room type unavailable.'; end if;
  if p_guests < 1 or p_guests > t.max_guests * p_rooms then
    raise exception 'Guest count exceeds capacity.'; end if;

  perform pg_advisory_xact_lock(hashtext(p_type::text));   -- serialise per room type
  select array_agg(id) into picked from (
    select r.id from rooms r
    where r.room_type_id = p_type and r.status = 'available'
      and not exists (select 1 from reservation_rooms rr where rr.room_id = r.id and rr.active
                      and rr.stay && daterange(p_in, p_out, '[)'))
    order by r.room_number limit p_rooms) x;
  if coalesce(array_length(picked,1),0) < p_rooms then
    raise exception 'Not enough rooms available for those dates.'; end if;

  n := p_out - p_in;
  sub := t.nightly_rate_ngn * n * p_rooms;
  vat := round(sub * 0.075, 2);
  ref := 'AUR-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));

  insert into reservations (reference, guest_id, room_type_id, check_in, check_out, guests, room_count,
      nightly_rate_ngn, nights, subtotal_ngn, vat_ngn, total_ngn, special_requests)
  values (ref, auth.uid(), p_type, p_in, p_out, p_guests, p_rooms,
      t.nightly_rate_ngn, n, sub, vat, sub + vat, left(p_requests, 500))
  returning id into rid;

  insert into reservation_rooms (reservation_id, room_id, stay)
  select rid, unnest(picked), daterange(p_in, p_out, '[)');
  insert into status_history (reservation_id, new_status, changed_by) values (rid, 'pending', auth.uid());
  return query select rid, ref, sub + vat;
end $$;

-- Cancellation policy (demo): free cancellation up to 48h before check-in; admins may cancel any time.
create or replace function cancel_reservation(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r reservations;
begin
  select * into r from reservations where id = p_id for update;
  if not found then raise exception 'Reservation not found.'; end if;
  if r.guest_id <> auth.uid() and not is_admin() then raise exception 'Not authorised.'; end if;
  if r.status not in ('pending','confirmed') then raise exception 'This reservation cannot be cancelled.'; end if;
  if not is_admin() and r.check_in < current_date + 2 then
    raise exception 'Cancellation window has passed (48 hours before check-in).'; end if;
  update reservations set status='cancelled', cancelled_at=now() where id = p_id;
  update reservation_rooms set active=false where reservation_id = p_id;
  insert into status_history (reservation_id, old_status, new_status, changed_by) values (p_id, r.status, 'cancelled', auth.uid());
end $$;

-- Admin-only state machine: pending→confirmed→checked_in→checked_out
create or replace function admin_set_status(p_id uuid, p_new reservation_status) returns void
language plpgsql security definer set search_path = public as $$
declare r reservations;
begin
  if not is_admin() then raise exception 'Administrators only.'; end if;
  select * into r from reservations where id = p_id for update;
  if not found then raise exception 'Reservation not found.'; end if;
  if p_new = 'cancelled' then perform cancel_reservation(p_id); return; end if;
  if not ((r.status='pending' and p_new='confirmed') or (r.status='confirmed' and p_new='checked_in')
       or (r.status='checked_in' and p_new='checked_out')) then
    raise exception 'Invalid transition % -> %', r.status, p_new; end if;
  update reservations set status = p_new where id = p_id;
  insert into status_history (reservation_id, old_status, new_status, changed_by) values (p_id, r.status, p_new, auth.uid());
end $$;
