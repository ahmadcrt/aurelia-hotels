-- AURELIA HOTELS (fictional demo) — seed.sql | Run THIRD (after schema.sql and security.sql)
-- All names, prices and inventory are DEMONSTRATION data. No real guests.

insert into room_types (slug, name, description, bed_type, max_guests, size_sqm, nightly_rate_ngn, amenities, image_url) values
('deluxe-room', 'Deluxe Room',
 'A calm, well-appointed retreat with a plush king bed, work desk and city views.',
 '1 King or 2 Twin', 2, 32, 85000,
 array['Free Wi-Fi','Air conditioning','Smart TV','Rain shower','Minibar','24h room service'],
 'assets/images/deluxe-room.jpg'),
('executive-room', 'Executive Room',
 'Generous space for business and leisure, with a lounge corner and executive amenities.',
 '1 King', 3, 42, 125000,
 array['Free Wi-Fi','Air conditioning','Smart TV','Lounge area','Nespresso machine','Bathtub','24h room service'],
 'assets/images/executive-room.jpg'),
('premium-suite', 'Premium Suite',
 'A separate living room and bedroom, curated for longer stays and quiet luxury.',
 '1 King + sofa bed', 4, 68, 220000,
 array['Free Wi-Fi','Separate living room','Dining nook','Walk-in wardrobe','Bathtub','Butler on request','24h room service'],
 'assets/images/premium-suite.jpg'),
('presidential-suite', 'Presidential Suite',
 'Our signature suite: panoramic views, private dining space and personalised service.',
 '1 King + 1 Queen', 6, 140, 480000,
 array['Free Wi-Fi','Panoramic views','Private dining room','Kitchenette','Jacuzzi','Dedicated butler','24h room service'],
 'assets/images/presidential-suite.jpg');

-- Physical inventory (room numbers by floor)
insert into rooms (room_type_id, room_number)
select rt.id, x.n from room_types rt
join (
  select 'deluxe-room' s, (200 + g)::text n from generate_series(1,8) g union all
  select 'executive-room', (300 + g)::text from generate_series(1,6) g union all
  select 'premium-suite', (400 + g)::text from generate_series(1,4) g union all
  select 'presidential-suite', '501'
) x on x.s = rt.slug;

-- Sanity check: expect 8 / 6 / 4 / 1
-- select rt.name, count(r.id) from room_types rt join rooms r on r.room_type_id = rt.id group by rt.name;
