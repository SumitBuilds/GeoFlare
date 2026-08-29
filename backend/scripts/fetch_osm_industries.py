"""
Script to fetch real industrial facility polygons from OpenStreetMap
using the Overpass API and generate SQL INSERT statements.
Covers Maharashtra, Karnataka, and Telangana.
"""
import httpx
import json
import sys

OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"

# Query for industrial areas with names in the bbox covering MH, KA, TG
# bbox format: south,west,north,east
QUERY = """
[out:json][timeout:120];
way["landuse"="industrial"]["name"](11.5,72.5,22.5,81.5);
out body geom 150;
"""

def way_to_polygon_wkt(geometry):
    """Convert Overpass way geometry to WKT polygon."""
    coords = []
    for pt in geometry:
        coords.append(f"{pt['lon']} {pt['lat']}")
    # Close the polygon if not already closed
    if coords and coords[0] != coords[-1]:
        coords.append(coords[0])
    if len(coords) < 4:
        return None
    return f"POLYGON(({', '.join(coords)}))"

def make_bbox_polygon(lat, lon, size_deg=0.005):
    """Fallback: create a small bounding box polygon from a center point."""
    return f"POLYGON(({lon-size_deg} {lat+size_deg}, {lon+size_deg} {lat+size_deg}, {lon+size_deg} {lat-size_deg}, {lon-size_deg} {lat-size_deg}, {lon-size_deg} {lat+size_deg}))"

def classify_facility(tags):
    """Determine facility_type from OSM tags."""
    name = (tags.get("name", "") + " " + tags.get("operator", "")).lower()
    industrial = tags.get("industrial", "").lower()
    
    if any(kw in name for kw in ["refinery", "petroleum", "petrochemical", "oil"]):
        return "Refinery"
    if any(kw in name for kw in ["steel", "iron", "ferro", "metal"]):
        return "Steel Plant"
    if any(kw in name for kw in ["power", "thermal", "ntpc", "genco", "energy"]):
        return "Power Plant"
    if any(kw in name for kw in ["chemical", "pharma", "fertilizer"]):
        return "Chemical Zone"
    if any(kw in name for kw in ["mine", "colliery", "coal", "mining"]):
        return "Mining"
    if industrial in ["port", "warehouse"]:
        return "Port/Logistics"
    return "Industrial Area"

def main():
    print("Fetching industrial areas from OpenStreetMap Overpass API...")
    print(f"Query bbox: 11.5°N-22.5°N, 72.5°E-81.5°E")
    
    import urllib.request
    import urllib.parse
    
    encoded_data = urllib.parse.urlencode({"data": QUERY}).encode("utf-8")
    req = urllib.request.Request(OVERPASS_URL, data=encoded_data)
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read().decode("utf-8")
    data = json.loads(raw)
    
    elements = data.get("elements", [])
    print(f"Found {len(elements)} industrial areas with names")
    
    sql_lines = []
    sql_lines.append("-- Auto-generated from OpenStreetMap Overpass API")
    sql_lines.append("-- Real industrial area polygons for Maharashtra, Karnataka, Telangana")
    sql_lines.append("-- Generated at: " + __import__("datetime").datetime.now().isoformat())
    sql_lines.append("")
    sql_lines.append("-- First, remove the approximate reference facilities we added earlier")
    sql_lines.append("DELETE FROM industrial_facilities WHERE name LIKE '%(Reference)%' AND id > 3;")
    sql_lines.append("")
    
    count = 0
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name", "").strip()
        if not name:
            continue
        
        # Try to get polygon geometry
        wkt = None
        if el.get("type") == "way" and "geometry" in el:
            wkt = way_to_polygon_wkt(el["geometry"])
        
        if not wkt:
            # Fallback to center point bounding box
            center = el.get("center", {})
            if not center and "bounds" in el:
                bounds = el["bounds"]
                center = {"lat": (bounds["minlat"] + bounds["maxlat"]) / 2, "lon": (bounds["minlon"] + bounds["maxlon"]) / 2}
            if center:
                wkt = make_bbox_polygon(center["lat"], center["lon"])
            else:
                continue
        
        facility_type = classify_facility(tags)
        
        # Escape single quotes in name
        safe_name = name.replace("'", "''")
        osm_id = el.get("id", "unknown")
        
        sql_lines.append(f"-- OSM ID: {osm_id}")
        sql_lines.append(f"INSERT INTO industrial_facilities (name, facility_type, location)")
        sql_lines.append(f"VALUES ('{safe_name} [OSM]', '{facility_type}', ST_GeogFromText('{wkt}'));")
        sql_lines.append("")
        count += 1
    
    output_path = "backend/db/migration_osm_industries.sql"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(sql_lines))
    
    print(f"Generated {count} facility INSERT statements")
    print(f"Saved to: {output_path}")

if __name__ == "__main__":
    main()
