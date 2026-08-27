import os

FIRMS_ENABLED = os.getenv("FIRMS_ENABLED", "false").lower() == "true"
FIRMS_MAP_KEY = os.getenv("FIRMS_MAP_KEY", "")
FIRMS_SOURCE = os.getenv("FIRMS_SOURCE", "VIIRS_SNPP_NRT")
FIRMS_BBOX = os.getenv("FIRMS_BBOX", "72.6,15.6,80.9,22.0")
FIRMS_DAY_RANGE = os.getenv("FIRMS_DAY_RANGE", "7")
FIRMS_TIMEOUT_SECONDS = int(os.getenv("FIRMS_TIMEOUT_SECONDS", "30"))

# Event Grouping Parameters
GROUPING_SPATIAL_DISTANCE_M = int(os.getenv("GROUPING_SPATIAL_DISTANCE_M", "1000"))
GROUPING_TIME_WINDOW_DAYS = int(os.getenv("GROUPING_TIME_WINDOW_DAYS", "7"))

# Weather integration
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
