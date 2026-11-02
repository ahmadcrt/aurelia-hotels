-- AURELIA HOTELS (fictional demo) — security.sql | Run SECOND (after schema.sql)

alter table profiles           enable row level security;
alter table room_types         enable row level security;
alter table rooms              enable row level security;
alter table reservations       enable row level security;
alter table reservation_rooms  enable row level security;
alter table status_history     enable row level security;
alter table contact_inquiries  enable row level security;

-- Start from zero privileges, then grant narrowly.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- Public catalogue
grant select on room_types to anon, authenticated;
create policy "active room types are public" on room_types for select using (is_active or is_admin());
create policy "admin manages room types" on room_types for all using (is_admin()) with check (is_admin());
grant insert, update, delete on room_types to authenticated;   -- RLS restricts to admins

grant select on rooms to authenticated;
create policy "admin reads rooms" on rooms for select using (is_admin());
create policy "admin manages rooms" on rooms for all using (is_admin()) with check (is_admin());
grant insert, update, delete on rooms to authenticated;

-- Profiles: column-level grant means role can NEVER be changed from the API.
grant select on profiles to authenticated;
grant update (full_name, phone) on profiles to authenticated;
create policy "own profile or admin read" on profiles for select using (id = auth.uid() or is_admin());
create policy "own profile update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Reservations: read-only via API. All writes go through the SECURITY DEFINER functions.
grant select on reservations, reservation_rooms, status_history to authenticated;
create policy "own reservations or admin" on reservations for select using (guest_id = auth.uid() or is_admin());
create policy "own reservation rooms or admin" on reservation_rooms for select
  using (is_admin() or exists (select 1 from reservations r where r.id = reservation_id and r.guest_id = auth.uid()));
create policy "own history or admin" on status_history for select
  using (is_admin() or exists (select 1 from reservations r where r.id = reservation_id and r.guest_id = auth.uid()));

-- Contact form: anyone may submit; only admins may read.
grant insert on contact_inquiries to anon, authenticated;
grant select on contact_inquiries to authenticated;
create policy "anyone submits inquiry" on contact_inquiries for insert with check (true);
create policy "admin reads inquiries" on contact_inquiries for select using (is_admin());

-- RPC access
grant execute on function available_room_count(uuid,date,date) to anon, authenticated;
grant execute on function create_reservation(uuid,date,date,int,int,text) to authenticated;
grant execute on function cancel_reservation(uuid) to authenticated;
grant execute on function admin_set_status(uuid, reservation_status) to authenticated;
grant execute on function is_admin() to authenticated;

-- FIRST ADMIN (safe procedure): 1) register normally on the site, 2) in the Supabase SQL Editor
-- (runs as the privileged postgres role, never exposed to browsers) execute:
--   update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR_EMAIL');
