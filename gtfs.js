// Minimal GTFS-realtime decoder: only the TripUpdate fields Softtab needs.
function varint(buf, pos) {
  let v = 0, mul = 1, b;
  do { b = buf[pos++]; v += (b & 0x7f) * mul; mul *= 128; } while (b & 0x80);
  return [v, pos];
}
function fields(buf, start, end, fn) {
  let pos = start;
  while (pos < end) {
    let key; [key, pos] = varint(buf, pos);
    const f = Math.floor(key / 8), wt = key % 8;
    if (wt === 0) { let v; [v, pos] = varint(buf, pos); fn(f, v); }
    else if (wt === 2) { let len; [len, pos] = varint(buf, pos); fn(f, null, pos, pos + len); pos += len; }
    else if (wt === 1) pos += 8;
    else if (wt === 5) pos += 4;
    else throw new Error('Unsupported wire type ' + wt);
  }
}
const utf8 = new TextDecoder();
function decodeTrips(bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const trips = [];
  fields(buf, 0, buf.length, (f, v, s, e) => {
    if (f !== 2) return;                       // FeedMessage.entity
    fields(buf, s, e, (f2, v2, s2, e2) => {
      if (f2 !== 3) return;                    // FeedEntity.trip_update
      const trip = { route: '', stops: [] };
      fields(buf, s2, e2, (f3, v3, s3, e3) => {
        if (f3 === 1) {                        // TripUpdate.trip
          fields(buf, s3, e3, (f4, v4, s4, e4) => { if (f4 === 5) trip.route = utf8.decode(buf.subarray(s4, e4)); });
        } else if (f3 === 2) {                 // TripUpdate.stop_time_update
          const st = { id: '', t: 0 };
          fields(buf, s3, e3, (f4, v4, s4, e4) => {
            if (f4 === 4) st.id = utf8.decode(buf.subarray(s4, e4));
            else if (f4 === 2 || f4 === 3) {   // arrival / departure
              fields(buf, s4, e4, (f5, v5) => { if (f5 === 2 && (f4 === 2 || !st.t)) st.t = v5; });
            }
          });
          trip.stops.push(st);
        }
      });
      trips.push(trip);
    });
  });
  return trips;
}
if (typeof module !== 'undefined') module.exports = { decodeTrips };
