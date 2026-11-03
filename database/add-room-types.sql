-- Optional: adds Junior Suite and Family Room (demo data). Run ONCE in the Supabase SQL Editor.
insert into room_types (slug,name,description,bed_type,max_guests,size_sqm,nightly_rate_ngn,amenities,image_url) values
('junior-suite','Junior Suite','An open-plan suite with a relaxed seating area, ideal for a longer stay.','1 King',3,52,170000,
 array['Free Wi-Fi','Seating area','Nespresso machine','Bathtub','Smart TV','24h room service'],'assets/images/junior-suite.jpg'),
('family-room','Family Room','Two comfortable sleeping areas and extra space, designed for families.','1 King + 2 Twin',5,55,150000,
 array['Free Wi-Fi','Two sleeping areas','Smart TV','Minibar','Child-friendly amenities on request','24h room service'],'assets/images/family-room.jpg');
insert into rooms (room_type_id, room_number)
select rt.id, x.n from room_types rt join (
  select 'junior-suite' s, (600+g)::text n from generate_series(1,4) g union all
  select 'family-room', (700+g)::text from generate_series(1,4) g) x on x.s = rt.slug;
