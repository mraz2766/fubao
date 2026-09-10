CREATE TABLE scenic_spots (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL
);
ALTER TABLE travel_entries ADD COLUMN spot_id TEXT REFERENCES scenic_spots(id);
CREATE TABLE travel_wishlist_next (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN('private','public')),
  created_at TEXT NOT NULL,
  spot_id TEXT REFERENCES scenic_spots(id)
);
INSERT INTO travel_wishlist_next(id,user_id,location_id,visibility,created_at)
SELECT id,user_id,location_id,visibility,created_at FROM travel_wishlist;
DROP TABLE travel_wishlist;
ALTER TABLE travel_wishlist_next RENAME TO travel_wishlist;
CREATE UNIQUE INDEX wishlist_place ON travel_wishlist(user_id,location_id,COALESCE(spot_id,''));
CREATE INDEX scenic_spot_location ON scenic_spots(location_id);
