-- Migration: Add industrial facilities across Maharashtra, Karnataka, and Telangana
-- All facilities are labelled as (Reference) to indicate seeded reference data.
-- Coordinates are approximate bounding-box polygons (~1km × 1km) around each facility.

-- ============================================================================
-- MAHARASHTRA
-- ============================================================================

-- BPCL Mumbai Refinery, Mahul
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'BPCL Mumbai Refinery, Mahul (Reference)',
    'Refinery',
    ST_GeogFromText('POLYGON((72.882 19.022, 72.892 19.022, 72.892 19.014, 72.882 19.014, 72.882 19.022))')
);

-- HPCL Mumbai Refinery, Mahul
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'HPCL Mumbai Refinery, Mahul (Reference)',
    'Refinery',
    ST_GeogFromText('POLYGON((72.888 19.026, 72.898 19.026, 72.898 19.018, 72.888 19.018, 72.888 19.026))')
);

-- Tata Power Trombay Thermal Power Station
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Tata Power Trombay TPS (Reference)',
    'Power Plant',
    ST_GeogFromText('POLYGON((72.885 19.015, 72.895 19.015, 72.895 19.007, 72.885 19.007, 72.885 19.015))')
);

-- Rashtriya Chemicals & Fertilizers, Chembur/Trombay
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'RCF Chembur Chemical Complex (Reference)',
    'Chemical Plant',
    ST_GeogFromText('POLYGON((72.890 19.040, 72.900 19.040, 72.900 19.032, 72.890 19.032, 72.890 19.040))')
);

-- JSW Steel Dolvi Works, Raigad
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'JSW Steel Dolvi Works, Raigad (Reference)',
    'Steel Plant',
    ST_GeogFromText('POLYGON((72.850 18.795, 72.860 18.795, 72.860 18.785, 72.850 18.785, 72.850 18.795))')
);

-- MIDC Taloja Industrial Area
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'MIDC Taloja Industrial Area (Reference)',
    'Industrial Area',
    ST_GeogFromText('POLYGON((73.112 19.078, 73.128 19.078, 73.128 19.062, 73.112 19.062, 73.112 19.078))')
);

-- MIDC Patalganga Chemical Zone
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'MIDC Patalganga Chemical Zone (Reference)',
    'Chemical Zone',
    ST_GeogFromText('POLYGON((73.240 18.960, 73.260 18.960, 73.260 18.940, 73.240 18.940, 73.240 18.960))')
);

-- Tarapur MIDC Industrial Area
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Tarapur MIDC Industrial Area (Reference)',
    'Industrial Area',
    ST_GeogFromText('POLYGON((72.670 19.860, 72.690 19.860, 72.690 19.840, 72.670 19.840, 72.670 19.860))')
);

-- Chakan Industrial Area, Pune
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Chakan Industrial Area, Pune (Reference)',
    'Manufacturing',
    ST_GeogFromText('POLYGON((73.850 18.770, 73.870 18.770, 73.870 18.750, 73.850 18.750, 73.850 18.770))')
);

-- Ranjangaon MIDC, Pune
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Ranjangaon MIDC, Pune (Reference)',
    'Manufacturing',
    ST_GeogFromText('POLYGON((74.120 18.740, 74.140 18.740, 74.140 18.720, 74.120 18.720, 74.120 18.740))')
);

-- Chandrapur Super Thermal Power Station (CSTPS)
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'CSTPS Chandrapur Super Thermal Power Station (Reference)',
    'Power Plant',
    ST_GeogFromText('POLYGON((79.260 19.960, 79.280 19.960, 79.280 19.940, 79.260 19.940, 79.260 19.960))')
);

-- Bhusawal Thermal Power Station, Deepnagar
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Bhusawal Thermal Power Station, Deepnagar (Reference)',
    'Power Plant',
    ST_GeogFromText('POLYGON((75.770 21.060, 75.790 21.060, 75.790 21.040, 75.770 21.040, 75.770 21.060))')
);

-- Chandrapur Ferro Alloy Plant (SAIL)
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'SAIL Chandrapur Ferro Alloy Plant (Reference)',
    'Steel Plant',
    ST_GeogFromText('POLYGON((79.290 19.970, 79.310 19.970, 79.310 19.950, 79.290 19.950, 79.290 19.970))')
);

-- Lote Parshuram MIDC, Ratnagiri
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Lote Parshuram MIDC, Ratnagiri (Reference)',
    'Chemical Zone',
    ST_GeogFromText('POLYGON((73.500 17.040, 73.520 17.040, 73.520 17.020, 73.500 17.020, 73.500 17.040))')
);

-- Nagpur MIDC Butibori
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Nagpur MIDC Butibori (Reference)',
    'Industrial Area',
    ST_GeogFromText('POLYGON((79.100 20.990, 79.120 20.990, 79.120 20.970, 79.100 20.970, 79.100 20.990))')
);

-- ============================================================================
-- KARNATAKA
-- ============================================================================

-- MRPL Mangalore Refinery
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'MRPL Mangalore Refinery (Reference)',
    'Refinery',
    ST_GeogFromText('POLYGON((74.800 12.920, 74.820 12.920, 74.820 12.900, 74.800 12.900, 74.800 12.920))')
);

-- JSW Steel Vijayanagar Works, Bellary
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'JSW Steel Vijayanagar Works, Bellary (Reference)',
    'Steel Plant',
    ST_GeogFromText('POLYGON((76.610 15.240, 76.635 15.240, 76.635 15.220, 76.610 15.220, 76.610 15.240))')
);

-- Raichur Thermal Power Station
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Raichur Thermal Power Station (Reference)',
    'Power Plant',
    ST_GeogFromText('POLYGON((76.460 16.180, 76.480 16.180, 76.480 16.160, 76.460 16.160, 76.460 16.180))')
);

-- Udupi Thermal Power Plant (UPCL)
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'UPCL Udupi Thermal Power Plant (Reference)',
    'Power Plant',
    ST_GeogFromText('POLYGON((74.710 13.330, 74.730 13.330, 74.730 13.310, 74.710 13.310, 74.710 13.330))')
);

-- Visvesvaraya Iron & Steel Plant (VISL), Bhadravati
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'VISL Bhadravati Iron & Steel Plant (Reference)',
    'Steel Plant',
    ST_GeogFromText('POLYGON((75.690 13.860, 75.710 13.860, 75.710 13.840, 75.690 13.840, 75.690 13.860))')
);

-- Peenya Industrial Area, Bangalore
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Peenya Industrial Area, Bangalore (Reference)',
    'Industrial Area',
    ST_GeogFromText('POLYGON((77.510 13.040, 77.530 13.040, 77.530 13.020, 77.510 13.020, 77.510 13.040))')
);

-- HAL (Hindustan Aeronautics), Bangalore
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'HAL Bangalore Aerospace Complex (Reference)',
    'Manufacturing',
    ST_GeogFromText('POLYGON((77.660 12.965, 77.680 12.965, 77.680 12.950, 77.660 12.950, 77.660 12.965))')
);

-- Bellary Thermal Power Station
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Bellary Thermal Power Station (Reference)',
    'Power Plant',
    ST_GeogFromText('POLYGON((76.370 15.170, 76.390 15.170, 76.390 15.150, 76.370 15.150, 76.370 15.170))')
);

-- ============================================================================
-- TELANGANA
-- ============================================================================

-- NTPC Ramagundam Super Thermal Power Station
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'NTPC Ramagundam STPS (Reference)',
    'Power Plant',
    ST_GeogFromText('POLYGON((79.440 18.770, 79.460 18.770, 79.460 18.750, 79.440 18.750, 79.440 18.770))')
);

-- Singareni Collieries, Kothagudem
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Singareni Collieries, Kothagudem (Reference)',
    'Mining',
    ST_GeogFromText('POLYGON((80.610 17.560, 80.630 17.560, 80.630 17.540, 80.610 17.540, 80.610 17.560))')
);

-- Patancheru Industrial Area, Hyderabad
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Patancheru Industrial Area, Hyderabad (Reference)',
    'Chemical Zone',
    ST_GeogFromText('POLYGON((78.260 17.540, 78.280 17.540, 78.280 17.520, 78.260 17.520, 78.260 17.540))')
);

-- Jeedimetla Industrial Area, Hyderabad
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Jeedimetla Industrial Area, Hyderabad (Reference)',
    'Industrial Area',
    ST_GeogFromText('POLYGON((78.430 17.510, 78.450 17.510, 78.450 17.490, 78.430 17.490, 78.430 17.510))')
);

-- BHEL Hyderabad
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'BHEL Hyderabad Complex (Reference)',
    'Manufacturing',
    ST_GeogFromText('POLYGON((78.520 17.400, 78.540 17.400, 78.540 17.380, 78.520 17.380, 78.520 17.400))')
);

-- Kakatiya Thermal Power Station, Chelpur
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Kakatiya Thermal Power Station, Chelpur (Reference)',
    'Power Plant',
    ST_GeogFromText('POLYGON((79.580 17.260, 79.600 17.260, 79.600 17.240, 79.580 17.240, 79.580 17.260))')
);

-- Bhadradri Thermal Power Plant, Manuguru
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Bhadradri Thermal Power Plant, Manuguru (Reference)',
    'Power Plant',
    ST_GeogFromText('POLYGON((80.720 17.970, 80.740 17.970, 80.740 17.950, 80.720 17.950, 80.720 17.970))')
);

-- Nacharam Industrial Area, Hyderabad
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Nacharam Industrial Area, Hyderabad (Reference)',
    'Industrial Area',
    ST_GeogFromText('POLYGON((78.545 17.420, 78.565 17.420, 78.565 17.400, 78.545 17.400, 78.545 17.420))')
);

-- Singareni Thermal Power Plant, Jaipur (Adilabad)
INSERT INTO industrial_facilities (name, facility_type, location)
VALUES (
    'Singareni Thermal Power Plant, Pegadapalli (Reference)',
    'Power Plant',
    ST_GeogFromText('POLYGON((79.300 19.130, 79.320 19.130, 79.320 19.110, 79.300 19.110, 79.300 19.130))')
);
