import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, RefreshCw, Eye, EyeOff, Filter, Globe } from "lucide-react";

declare global {
  interface Window {
    L: any;
  }
}

interface Container {
  id: string;
  containerCode: string;
  type: string;
  capacity: string;
  status: string;
  healthScore: number;
  excelMetadata?: {
    location?: string;
    depot?: string;
    status?: string;
    productType?: string;
    grade?: string;
    yom?: number;
  };
  currentLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };
  orbcommDeviceId?: string;
  hasIot: boolean;
}

interface GlobalFleetMapProps {
  containers: Container[];
}

// Major global port cities and their coordinates
const GLOBAL_PORTS = [
  // Asia Pacific
  { name: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198 },
  { name: "Shanghai", country: "China", lat: 31.2304, lng: 121.4737 },
  { name: "Shenzhen", country: "China", lat: 22.5431, lng: 114.0579 },
  { name: "Ningbo", country: "China", lat: 29.8683, lng: 121.5440 },
  { name: "Guangzhou", country: "China", lat: 23.1291, lng: 113.2644 },
  { name: "Busan", country: "South Korea", lat: 35.1796, lng: 129.0756 },
  { name: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503 },
  { name: "Yokohama", country: "Japan", lat: 35.4437, lng: 139.6380 },
  { name: "Kobe", country: "Japan", lat: 34.6901, lng: 135.1956 },
  { name: "Hong Kong", country: "Hong Kong", lat: 22.3193, lng: 114.1694 },
  { name: "Kaohsiung", country: "Taiwan", lat: 22.6273, lng: 120.3014 },
  { name: "Mumbai", country: "India", lat: 19.0760, lng: 72.8777 },
  { name: "Chennai", country: "India", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata", country: "India", lat: 22.5726, lng: 88.3639 },
  { name: "Cochin", country: "India", lat: 9.9312, lng: 76.2673 },
  { name: "Dubai", country: "UAE", lat: 25.2048, lng: 55.2708 },
  { name: "Jebel Ali", country: "UAE", lat: 25.0267, lng: 55.0750 },
  { name: "Doha", country: "Qatar", lat: 25.2854, lng: 51.5310 },
  { name: "Kuwait", country: "Kuwait", lat: 29.3759, lng: 47.9774 },
  { name: "Bangkok", country: "Thailand", lat: 13.7563, lng: 100.5018 },
  { name: "Ho Chi Minh City", country: "Vietnam", lat: 10.8231, lng: 106.6297 },
  { name: "Manila", country: "Philippines", lat: 14.5995, lng: 120.9842 },
  { name: "Jakarta", country: "Indonesia", lat: -6.2088, lng: 106.8456 },
  { name: "Kuala Lumpur", country: "Malaysia", lat: 3.1390, lng: 101.6869 },
  { name: "Colombo", country: "Sri Lanka", lat: 6.9271, lng: 79.8612 },
  { name: "Karachi", country: "Pakistan", lat: 24.8607, lng: 67.0011 },
  { name: "Chittagong", country: "Bangladesh", lat: 22.3569, lng: 91.7832 },
  
  // Europe
  { name: "Rotterdam", country: "Netherlands", lat: 51.9244, lng: 4.4777 },
  { name: "Antwerp", country: "Belgium", lat: 51.2194, lng: 4.4025 },
  { name: "Hamburg", country: "Germany", lat: 53.5511, lng: 9.9937 },
  { name: "Bremen", country: "Germany", lat: 53.0793, lng: 8.8017 },
  { name: "Wilhelmshaven", country: "Germany", lat: 53.5200, lng: 8.1065 },
  { name: "Le Havre", country: "France", lat: 49.4944, lng: 0.1079 },
  { name: "Marseille", country: "France", lat: 43.2965, lng: 5.3698 },
  { name: "Fos-sur-Mer", country: "France", lat: 43.4372, lng: 4.9446 },
  { name: "Valencia", country: "Spain", lat: 39.4699, lng: -0.3763 },
  { name: "Barcelona", country: "Spain", lat: 41.3851, lng: 2.1734 },
  { name: "Algeciras", country: "Spain", lat: 36.1408, lng: -5.4565 },
  { name: "Genoa", country: "Italy", lat: 44.4056, lng: 8.9463 },
  { name: "La Spezia", country: "Italy", lat: 44.1025, lng: 9.8258 },
  { name: "Gioia Tauro", country: "Italy", lat: 38.4250, lng: 15.8950 },
  { name: "Southampton", country: "UK", lat: 50.9097, lng: -1.4044 },
  { name: "Felixstowe", country: "UK", lat: 51.9486, lng: 1.3522 },
  { name: "Liverpool", country: "UK", lat: 53.4084, lng: -2.9916 },
  { name: "London", country: "UK", lat: 51.5074, lng: -0.1278 },
  { name: "Gothenburg", country: "Sweden", lat: 57.7089, lng: 11.9746 },
  { name: "Copenhagen", country: "Denmark", lat: 55.6761, lng: 12.5683 },
  { name: "Oslo", country: "Norway", lat: 59.9139, lng: 10.7522 },
  { name: "Helsinki", country: "Finland", lat: 60.1699, lng: 24.9384 },
  { name: "Gdansk", country: "Poland", lat: 54.3520, lng: 18.6466 },
  { name: "Gdynia", country: "Poland", lat: 54.5189, lng: 18.5305 },
  { name: "St. Petersburg", country: "Russia", lat: 59.9311, lng: 30.3609 },
  { name: "Istanbul", country: "Turkey", lat: 41.0082, lng: 28.9784 },
  { name: "Piraeus", country: "Greece", lat: 37.9755, lng: 23.7348 },
  { name: "Thessaloniki", country: "Greece", lat: 40.6401, lng: 22.9444 },
  
  // North America
  { name: "Los Angeles", country: "USA", lat: 33.7175, lng: -118.2726 },
  { name: "Long Beach", country: "USA", lat: 33.7701, lng: -118.1937 },
  { name: "Oakland", country: "USA", lat: 37.8044, lng: -122.2712 },
  { name: "Seattle", country: "USA", lat: 47.6062, lng: -122.3321 },
  { name: "Tacoma", country: "USA", lat: 47.2529, lng: -122.4443 },
  { name: "Vancouver", country: "Canada", lat: 49.2827, lng: -123.1207 },
  { name: "Prince Rupert", country: "Canada", lat: 54.3151, lng: -130.3208 },
  { name: "New York", country: "USA", lat: 40.7128, lng: -74.0060 },
  { name: "Newark", country: "USA", lat: 40.7357, lng: -74.1724 },
  { name: "Norfolk", country: "USA", lat: 36.8468, lng: -76.2852 },
  { name: "Charleston", country: "USA", lat: 32.7765, lng: -79.9311 },
  { name: "Savannah", country: "USA", lat: 32.0835, lng: -81.0998 },
  { name: "Jacksonville", country: "USA", lat: 30.3322, lng: -81.6557 },
  { name: "Miami", country: "USA", lat: 25.7617, lng: -80.1918 },
  { name: "Houston", country: "USA", lat: 29.7604, lng: -95.3698 },
  { name: "New Orleans", country: "USA", lat: 29.9511, lng: -90.0715 },
  { name: "Montreal", country: "Canada", lat: 45.5017, lng: -73.5673 },
  { name: "Halifax", country: "Canada", lat: 44.6488, lng: -63.5752 },
  
  // South America
  { name: "Santos", country: "Brazil", lat: -23.9608, lng: -46.3331 },
  { name: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lng: -43.1729 },
  { name: "Buenos Aires", country: "Argentina", lat: -34.6118, lng: -58.3960 },
  { name: "Valparaiso", country: "Chile", lat: -33.0458, lng: -71.6197 },
  { name: "Callao", country: "Peru", lat: -12.0464, lng: -77.0428 },
  { name: "Cartagena", country: "Colombia", lat: 10.3910, lng: -75.4794 },
  { name: "Guayaquil", country: "Ecuador", lat: -2.1894, lng: -79.8890 },
  { name: "Montevideo", country: "Uruguay", lat: -34.9011, lng: -56.1645 },
  
  // Africa
  { name: "Cape Town", country: "South Africa", lat: -33.9249, lng: 18.4241 },
  { name: "Durban", country: "South Africa", lat: -29.8587, lng: 31.0218 },
  { name: "Port Elizabeth", country: "South Africa", lat: -33.9608, lng: 25.6022 },
  { name: "Lagos", country: "Nigeria", lat: 6.5244, lng: 3.3792 },
  { name: "Tema", country: "Ghana", lat: 5.6037, lng: -0.1870 },
  { name: "Abidjan", country: "Ivory Coast", lat: 5.3600, lng: -4.0083 },
  { name: "Dakar", country: "Senegal", lat: 14.6928, lng: -17.4467 },
  { name: "Casablanca", country: "Morocco", lat: 33.5731, lng: -7.5898 },
  { name: "Alexandria", country: "Egypt", lat: 31.2001, lng: 29.9187 },
  { name: "Port Said", country: "Egypt", lat: 31.2653, lng: 32.3019 },
  { name: "Mombasa", country: "Kenya", lat: -4.0435, lng: 39.6682 },
  { name: "Dar es Salaam", country: "Tanzania", lat: -6.7924, lng: 39.2083 },
  
  // Oceania
  { name: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093 },
  { name: "Melbourne", country: "Australia", lat: -37.8136, lng: 144.9631 },
  { name: "Brisbane", country: "Australia", lat: -27.4698, lng: 153.0251 },
  { name: "Fremantle", country: "Australia", lat: -32.0564, lng: 115.7474 },
  { name: "Adelaide", country: "Australia", lat: -34.9285, lng: 138.6007 },
  { name: "Auckland", country: "New Zealand", lat: -36.8485, lng: 174.7633 },
  { name: "Wellington", country: "New Zealand", lat: -41.2924, lng: 174.7787 },
  { name: "Christchurch", country: "New Zealand", lat: -43.5321, lng: 172.6362 }
];

// India-specific cities, ports, suburbs and industrial hubs commonly present in Excel
const INDIA_LOCATIONS = [
  { name: "JNPT", country: "India", lat: 18.9483, lng: 72.9516 }, // Nhava Sheva
  { name: "Nhava Sheva", country: "India", lat: 18.9483, lng: 72.9516 },
  { name: "Navi Mumbai", country: "India", lat: 19.0330, lng: 73.0297 },
  { name: "Borivali", country: "India", lat: 19.2307, lng: 72.8567 },
  { name: "Bhiwandi", country: "India", lat: 19.2813, lng: 73.0483 },
  { name: "Taloja", country: "India", lat: 19.0745, lng: 73.1026 },
  { name: "Panvel", country: "India", lat: 18.9894, lng: 73.1175 },
  { name: "Chakan", country: "India", lat: 18.7549, lng: 73.8476 },
  { name: "Pune", country: "India", lat: 18.5204, lng: 73.8567 },
  { name: "Bangalore", country: "India", lat: 12.9716, lng: 77.5946 },
  { name: "Bengaluru", country: "India", lat: 12.9716, lng: 77.5946 },
  { name: "Hyderabad", country: "India", lat: 17.3850, lng: 78.4867 },
  { name: "Solapur", country: "India", lat: 17.6599, lng: 75.9064 },
  { name: "Anantapur", country: "India", lat: 14.6819, lng: 77.6006 },
  { name: "Ananthapur", country: "India", lat: 14.6819, lng: 77.6006 },
  { name: "Nakkapalli", country: "India", lat: 17.5833, lng: 82.8333 },
  { name: "Visakhapatnam", country: "India", lat: 17.6868, lng: 83.2185 },
  { name: "Krishna", country: "India", lat: 16.5730, lng: 80.3570 },
  { name: "Krishna Dairy", country: "India", lat: 16.5730, lng: 80.3570 },
  { name: "Raigad", country: "India", lat: 18.5158, lng: 73.1822 },
  { name: "Alibag", country: "India", lat: 18.6414, lng: 72.8722 },
  { name: "Uran", country: "India", lat: 18.8780, lng: 72.9390 },
  { name: "Ranchi", country: "India", lat: 23.3441, lng: 85.3096 },
  { name: "Jharkhand", country: "India", lat: 23.6102, lng: 85.2799 },
  { name: "ARAI", country: "India", lat: 18.5322, lng: 73.8122 },
  { name: "Divis Labs", country: "India", lat: 17.4833, lng: 82.6167 },
  { name: "HPHT color Diamonds LLP", country: "India", lat: 19.0760, lng: 72.8777 },
  { name: "Tata Advance", country: "India", lat: 12.9900, lng: 77.6185 },
  { name: "Honour Labs Limited", country: "India", lat: 17.6868, lng: 83.2185 },
  { name: "Bardhaman", country: "India", lat: 23.2338, lng: 87.8615 },
  { name: "Bidar", country: "India", lat: 17.9133, lng: 77.5301 },
  { name: "Lucknow", country: "India", lat: 26.8467, lng: 80.9462 },
  { name: "Junagadh", country: "India", lat: 21.5222, lng: 70.4579 }
];

// Key Indian states (centroids) for state-only references
const INDIA_STATES: Record<string, { lat: number; lng: number; name: string }> = {
  "maharashtra": { lat: 19.7515, lng: 75.7139, name: "Maharashtra" },
  "karnataka": { lat: 15.3173, lng: 75.7139, name: "Karnataka" },
  "tamilnadu": { lat: 11.1271, lng: 78.6569, name: "Tamil Nadu" },
  "tamil nadu": { lat: 11.1271, lng: 78.6569, name: "Tamil Nadu" },
  "telangana": { lat: 18.1124, lng: 79.0193, name: "Telangana" },
  "andhra": { lat: 15.9129, lng: 79.7400, name: "Andhra Pradesh" },
  "andhra pradesh": { lat: 15.9129, lng: 79.7400, name: "Andhra Pradesh" },
  "west bengal": { lat: 22.9868, lng: 87.8550, name: "West Bengal" },
  "bengal": { lat: 22.9868, lng: 87.8550, name: "West Bengal" },
  "punjab": { lat: 31.1471, lng: 75.3412, name: "Punjab" },
  "jharkhand": { lat: 23.6102, lng: 85.2799, name: "Jharkhand" },
  "gujarat": { lat: 22.2587, lng: 71.1924, name: "Gujarat" },
};

// Synonyms / suburbs to anchor cities
const CITY_SYNONYMS: Record<string, string> = {
  // Mumbai region
  "malad": "mumbai",
  "ghatkopar": "mumbai",
  "borivali": "mumbai",
  "bhiwandi": "mumbai",
  "taloja": "navi mumbai",
  "panvel": "navi mumbai",
  // Spelling variants
  "burdwan": "bardhaman",
  "bangalore": "bengaluru",
  "banglore": "bengaluru",
  "vizag": "visakhapatnam",
  "junagad": "junagadh",
  "baramati": "baramati",
};

const normalizeText = (text: string) =>
  (text || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/c\/?o\s+[^,]+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractTokens = (location: string, depot: string) => {
  const merged = `${location} ${depot}`.trim();
  const raw = merged.split(/[\s,]+/).filter(Boolean);
  return raw.map(t => CITY_SYNONYMS[t] || t);
};

// Location mapping for known locations
const LOCATION_MAPPING: Record<string, { lat: number; lng: number; name: string; country: string }> = {};

// Initialize location mapping
GLOBAL_PORTS.forEach(port => {
  const key = port.name.toLowerCase().replace(/\s+/g, '');
  LOCATION_MAPPING[key] = {
    lat: port.lat,
    lng: port.lng,
    name: port.name,
    country: port.country
  };
  
  // Also add country-based mapping
  const countryKey = port.country.toLowerCase().replace(/\s+/g, '');
  if (!LOCATION_MAPPING[countryKey]) {
    LOCATION_MAPPING[countryKey] = {
      lat: port.lat,
      lng: port.lng,
      name: port.name,
      country: port.country
    };
  }
});

// Seed LOCATION_MAPPING with India-specific locations as well
INDIA_LOCATIONS.forEach(loc => {
  const key = loc.name.toLowerCase().replace(/\s+/g, '');
  LOCATION_MAPPING[key] = {
    lat: loc.lat,
    lng: loc.lng,
    name: loc.name,
    country: loc.country
  };
});

export default function GlobalFleetMap({ containers }: GlobalFleetMapProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const resolvedCacheRef = useRef<Map<string, { lat: number; lng: number; name: string; country: string }>>(new Map());
  // Persisted cache key for localStorage
  const CACHE_KEY = 'container_location_cache_v3';
  const [showMarkers, setShowMarkers] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDepot, setFilterDepot] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [region, setRegion] = useState<'india' | 'global'>(
    (typeof localStorage !== 'undefined' && (localStorage.getItem('map_region') as 'india' | 'global')) || 'india'
  );
  const HAS_GOOGLE = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ? true : false;

  // Load persisted cache on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        const m = new Map<string, { lat: number; lng: number; name: string; country: string }>(Object.entries(obj));
        resolvedCacheRef.current = m;
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('map_region', region); } catch {}
  }, [region]);

  const persistCache = () => {
    try {
      const obj: Record<string, { lat: number; lng: number; name: string; country: string }> = {};
      resolvedCacheRef.current.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch {}
  };

  // Heuristic: determine if the location/depot is most likely in India
  const isLikelyIndia = (location: string, depot: string) => {
    const text = `${location} ${depot}`.toLowerCase();
    // If explicit non-India country is present, bail out early
    const nonIndiaCountries = [
      'nigeria','ghana','kenya','tanzania','egypt','morocco','senegal','ivory coast','cote d ivoire',
      'south africa','uae','united arab emirates','qatar','saudi','oman','kuwait',
      'spain','france','italy','uk','united kingdom','germany','poland','russia','turkey','greece',
      'usa','united states','canada','mexico','brazil','argentina','chile','peru',
      'australia','new zealand','japan','korea','china','taiwan','singapore','malaysia','indonesia','vietnam','thailand','philippines','sri lanka','pakistan','bangladesh'
    ];
    if (nonIndiaCountries.some(c => text.includes(c))) return false;

    // India markers (no single-letter or ambiguous tokens)
    const indiaMarkers = [
      'india',
      // frequent depot/city markers
      'mumbai','jnpt','nhava','sheva','navi mumbai','thane','bhiwandi','borivali','taloja','panvel',
      'pune','chakan','bengaluru','bangalore','hyderabad','visakhapatnam','vizag','solapur','anantapur','ananthapur',
      'chennai','ennore','kattupalli','kochi','cochin','kolkata','howrah','ahmedabad','surat','vadodara','vapi',
      'andhra','telangana','tamil nadu','maharashtra','gujarat','karnataka','kerala','west bengal','jharkhand','punjab'
    ];
    return indiaMarkers.some(k => text.includes(k));
  };

  const isLikelyNonIndia = (location: string, depot: string) => {
    const text = `${location} ${depot}`.toLowerCase();
    const nonIndiaCountries = [
      'nigeria','ghana','kenya','tanzania','egypt','morocco','senegal','ivory coast','cote d ivoire',
      'south africa','uae','united arab emirates','qatar','saudi','oman','kuwait',
      'spain','france','italy','uk','united kingdom','germany','poland','russia','turkey','greece',
      'usa','united states','canada','mexico','brazil','argentina','chile','peru',
      'australia','new zealand','japan','korea','china','taiwan','singapore','malaysia','indonesia','vietnam','thailand','philippines','sri lanka','pakistan','bangladesh'
    ];
    const nonIndiaCities = [
      'lagos','abuja','port harcourt','accra','tema','tamale','kumasi',
      'doha','dubai','jebel ali','abu dhabi','riyadh','jeddah','dammam','muscat','kuwait city',
      'paris','marseille','lyon','rome','milan','naples','madrid','barcelona','valencia','seville','london','manchester','birmingham','berlin','hamburg','munich','istanbul','athens',
      'new york','los angeles','long beach','seattle','vancouver','montreal','toronto','mexico city','santos','rio de janeiro','buenos aires','lima','santiago',
      'sydney','melbourne','auckland','tokyo','osaka','seoul','busan','shanghai','ningbo','tianjin','taipei','singapore','kuala lumpur','jakarta','ho chi minh','bangkok','manila'
    ];
    return nonIndiaCountries.some(c => text.includes(c)) || nonIndiaCities.some(c => text.includes(c));
  };

  // Get coordinates for a location string using your actual container data
  const getLocationCoordinates = async (location: string, depot: string): Promise<{ lat: number; lng: number; name: string; country: string }> => {
    const cacheKey = `${location}|${depot}`.toLowerCase();
    if (resolvedCacheRef.current.has(cacheKey)) {
      return resolvedCacheRef.current.get(cacheKey)!;
    }
    const indiaPreferred = isLikelyIndia(location, depot);
    const nonIndiaPreferred = isLikelyNonIndia(location, depot);
    // Normalize and tokenize
    const locationKey = normalizeText(location);
    const depotKey = normalizeText(depot);
    const tokens = extractTokens(locationKey, depotKey);
    
    // Check for your specific locations first
    if (locationKey.includes('nicon marine') || locationKey.includes('nicon')) {
      return {
        lat: 13.0843,
        lng: 80.2904,
        name: 'Nicon Marine, Chennai',
        country: 'India'
      };
    }
    
    if (locationKey.includes('zircon')) {
      return {
        lat: 13.2300,
        lng: 80.3200,
        name: 'Zircon, Chennai',
        country: 'India'
      };
    }
    
    // Check if depot is Chennai and use Chennai area coordinates
    if (region === 'india' && depotKey.includes('chennai')) {
      // Use different Chennai area coordinates based on location
      if (locationKey.includes('port') || locationKey.includes('marine')) {
        return {
          lat: 13.0843,
          lng: 80.2904,
          name: `${location}, Chennai Port`,
          country: 'India'
        };
      } else if (locationKey.includes('ennore') || locationKey.includes('zircon')) {
        return {
          lat: 13.2300,
          lng: 80.3200,
          name: `${location}, Ennore Port`,
          country: 'India'
        };
      } else {
        // Default Chennai area with slight variation
        return {
          lat: 13.0827 + (Math.random() - 0.5) * 0.1,
          lng: 80.2707 + (Math.random() - 0.5) * 0.1,
          name: `${location}, Chennai`,
          country: 'India'
        };
      }
    }
    
    // Check for other known locations from your data
    const locationKeyClean = locationKey.replace(/\s+/g, '');
    
    // If Google API is configured, skip hardcoded dictionary and rely on geocoding
    const GOOGLE_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_API_KEY && LOCATION_MAPPING[locationKeyClean]) {
      const coords = LOCATION_MAPPING[locationKeyClean];
      // Enforce country consistency based on preference
      if (indiaPreferred && coords.country !== 'India') {
        // If depot mentions Maharashtra districts like Raigad, Navi Mumbai area, bias to India
        if (depotKey.includes('maharashtra') || depotKey.includes('raigad') || depotKey.includes('mumbai') || depotKey.includes('jnpt') || depotKey.includes('nhava')) {
          return LOCATION_MAPPING['raigad'] || coords;
        }
        // Otherwise reject non-India for Indian-pref input
      }
      if (nonIndiaPreferred && coords.country === 'India') {
        // Do not accept India match when an explicit non-India country is present
        // proceed to other checks
      } else {
      return coords;
      }
    }
    
    // Try token-based dictionary lookup first
    for (const t of tokens) {
      const k = t.replace(/\s+/g, '');
      if (!GOOGLE_API_KEY && LOCATION_MAPPING[k]) {
        const coords = LOCATION_MAPPING[k];
        if (indiaPreferred && coords.country !== 'India') continue;
        if (nonIndiaPreferred && coords.country === 'India') continue;
        return coords;
      }
    }

    // Check for partial matches in location name
    for (const [key, coords] of Object.entries(LOCATION_MAPPING)) {
      if (locationKeyClean.includes(key) || key.includes(locationKeyClean)) {
        // If we prefer India but this mapped city is outside India, skip unless the
        // input clearly references a non-India place
        if (indiaPreferred && coords.country !== 'India') continue;
        if (nonIndiaPreferred && coords.country === 'India') continue;
        return coords;
      }
    }

    // Strong override: if text contains Jharkhand/Ranchi explicitly, return Ranchi
    if (locationKey.includes('ranchi') || locationKey.includes('jharkhand')) {
      return LOCATION_MAPPING['ranchi'] || { lat: 23.3441, lng: 85.3096, name: 'Ranchi, Jharkhand', country: 'India' };
    }
    
    // If a state is mentioned, use state centroid
    for (const t of tokens) {
      if (INDIA_STATES[t]) {
        const s = INDIA_STATES[t];
        return { lat: s.lat, lng: s.lng, name: s.name, country: 'India' };
      }
    }

    // Check if depot contains a known country/city
    const depotKeyClean = depotKey.replace(/\s+/g, '');
    if (LOCATION_MAPPING[depotKeyClean]) {
      return LOCATION_MAPPING[depotKeyClean];
    }
    for (const name in INDIA_STATES) {
      if (depotKey.includes(name)) {
        const s = INDIA_STATES[name];
        return { lat: s.lat, lng: s.lng, name: s.name, country: 'India' };
      }
    }
    
    // Optional Google Geocoding fallback for higher accuracy when dictionary fails
    // Provide VITE_GOOGLE_MAPS_API_KEY in your env to enable
    if (GOOGLE_API_KEY) {
      try {
        const query = `${location} ${depot}`.trim();
        const params = new URLSearchParams({ address: query, key: GOOGLE_API_KEY });
        if (indiaPreferred) {
          // Bias to India without forcing; region biases results
          params.append('region', 'in');
          // components can further restrict
          params.append('components', 'country:IN');
        }
        const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.status === 'OK' && data.results && data.results.length > 0) {
          const best = data.results[0];
          const coords = {
            lat: best.geometry.location.lat,
            lng: best.geometry.location.lng,
            name: best.formatted_address || best.place_id,
            country: (best.address_components?.find((c: any) => c.types?.includes('country'))?.long_name) || 'Unknown'
          };
          // Enforce preference consistency
          if (indiaPreferred && coords.country !== 'India') {
            // discard this result and continue to fallback below
          } else if (nonIndiaPreferred && coords.country === 'India') {
            // discard India result if explicit non-India detected
          } else {
            resolvedCacheRef.current.set(cacheKey, coords);
            persistCache();
            return coords;
          }
        }
      } catch {}
    }

    // Free alternative: OpenStreetMap Nominatim (no key required)
    // Used when Google key is absent or result discarded by preferences
    try {
      const query = `${depot} ${location}`.trim();
      // Helper to call Nominatim with optional India bias and bounding box
      const callNominatim = async (biasIndia: boolean) => {
        const params = new URLSearchParams({
          format: 'json',
          q: query,
          limit: '1',
          addressdetails: '1',
        });
        if (biasIndia) {
          // Prefer India by restricting country and adding India viewbox
          params.append('countrycodes', 'IN');
          // India approximate bbox (lon,lat pairs): left,top,right,bottom
          params.append('viewbox', '68.1766451354,37.0902398031,97.4025614766,8.088306932');
          params.append('bounded', '1');
        }
        // Use our proxy endpoint to avoid CORS issues
        const proxyUrl = `/api/proxy/nominatim?${params.toString()}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const best = data[0];
          return {
            lat: parseFloat(best.lat),
            lng: parseFloat(best.lon),
            name: best.display_name || query,
            country: best.address?.country || 'Unknown',
          } as { lat: number; lng: number; name: string; country: string };
        }
        return null;
      };

      // Phase 1: If India is likely, try India-biased first
      if (indiaPreferred) {
        const result = await callNominatim(true);
        if (result && result.country === 'India') {
          resolvedCacheRef.current.set(cacheKey, result);
          persistCache();
          return result;
        }
        // If we got a non-India result, fall through to global retry
      }

      // Phase 2: Global retry (no bias) or for explicit non-India
      const result = await callNominatim(false);
      if (result) {
        // If the token set contains strong India cities (vizag/visakhapatnam, baramati), override to India coordinates
        const strongIndiaTokens = ['visakhapatnam','vizag','baramati','bengaluru','bangalore','chennai','mumbai','pune'];
        const tokenStr = `${locationKey} ${depotKey}`;
        const containsStrongIndia = strongIndiaTokens.some(t => tokenStr.includes(t));
        if (containsStrongIndia && result.country !== 'India') {
          // Override by returning dictionary coordinates for those cities
          const overrideKey = tokenStr.includes('vizag') || tokenStr.includes('visakhapatnam') ? 'visakhapatnam'
                            : tokenStr.includes('baramati') ? 'baramati'
                            : '';
          if (overrideKey && LOCATION_MAPPING[overrideKey]) {
            const coords = LOCATION_MAPPING[overrideKey];
            resolvedCacheRef.current.set(cacheKey, coords);
            persistCache();
            return coords;
          }
        }
        if (indiaPreferred && result.country !== 'India') {
          // Reject clearly wrong country when India was strongly indicated
        } else if (nonIndiaPreferred && result.country === 'India') {
          // Reject India if non-India was explicit
        } else {
          resolvedCacheRef.current.set(cacheKey, result);
          persistCache();
          return result;
        }
      }
    } catch {}
    
    // If all else fails, use a default location based on depot or India preference
    if ((region === 'india' && indiaPreferred) || depotKey.includes('india') || depotKey.includes('chennai')) {
      return {
        lat: 13.0827,
        lng: 80.2707,
        name: `${location} (${depot})`,
        country: 'India'
      };
    }
    
    // Default fallback - use neutral global centroid to avoid misleading placement
    const coords = {
      lat: 20.0,
      lng: 0.0,
      name: `${location} (${depot})`,
      country: 'Unknown'
    };
    resolvedCacheRef.current.set(cacheKey, coords);
    persistCache();
    return coords;
  };

  // Process containers and assign coordinates
  const [containersWithLocations, setContainersWithLocations] = useState<Container[]>([]);

  useEffect(() => {
    const processContainers = async () => {
      if (!containers || containers.length === 0) return;
      
      setIsLoading(true);
      const processedContainers: Container[] = [];

      // 1) Build unique location+depot keys only for containers lacking DB coordinates
      const uniqueKeyToLoc: Map<string, { location: string; depot: string }> = new Map();
      containers.forEach(c => {
        const location = c.excelMetadata?.location || 'Unknown';
        const depot = c.excelMetadata?.depot || 'Unknown';
        const key = `${location}|${depot}`.toLowerCase();
        const hasDbCoords = !!(c.currentLocation && typeof c.currentLocation.lat === 'number' && typeof c.currentLocation.lng === 'number');
        if (!hasDbCoords) {
          if (!uniqueKeyToLoc.has(key)) uniqueKeyToLoc.set(key, { location, depot });
        }
      });

      // 2) Resolve coordinates for unique keys; prioritize quick first paint
      // We'll resolve up to FAST_LIMIT synchronously, render, then geocode the rest in background
      const GEOCODE_BATCH = HAS_GOOGLE ? 10 : 2;
      const FAST_LIMIT = HAS_GOOGLE ? 80 : 40;
      const keys = Array.from(uniqueKeyToLoc.keys());
      const resolved: Map<string, { lat: number; lng: number; name: string; country: string }> = new Map();

      for (let i = 0; i < Math.min(keys.length, FAST_LIMIT); i += GEOCODE_BATCH) {
        const batchKeys = keys.slice(i, i + GEOCODE_BATCH);
        for (let j = 0; j < batchKeys.length; j++) {
          const key = batchKeys[j];
          const { location, depot } = uniqueKeyToLoc.get(key)!;
          const coords = await getLocationCoordinates(location, depot);
          resolved.set(key, coords);
          if (!HAS_GOOGLE) { await new Promise(r => setTimeout(r, 600)); }
        }
        if (HAS_GOOGLE && i + GEOCODE_BATCH < keys.length) { await new Promise(r => setTimeout(r, 80)); }
      }

      // Assign quick approximations for the rest to render immediately
      if (keys.length > FAST_LIMIT) {
        for (let i = FAST_LIMIT; i < keys.length; i++) {
          const key = keys[i];
          const { location, depot } = uniqueKeyToLoc.get(key)!;
          // Heuristic: if looks like India, drop near India centroid; else global centroid
          const india = isLikelyIndia(location, depot);
          resolved.set(key, india ? { lat: 22.3511, lng: 78.6677, name: `${location} (${depot})`, country: 'India' }
                                 : { lat: 20.0, lng: 0.0, name: `${location} (${depot})`, country: 'Unknown' });
        }
      }

      // 3) Map containers using resolved coordinates
      containers.forEach(c => {
        const location = c.excelMetadata?.location || 'Unknown';
        const depot = c.excelMetadata?.depot || 'Unknown';
        const key = `${location}|${depot}`.toLowerCase();
        // Prefer real-time currentLocation from DB if available
        if (c.currentLocation && typeof c.currentLocation.lat === 'number' && typeof c.currentLocation.lng === 'number') {
          processedContainers.push({
            ...c,
            currentLocation: {
              lat: c.currentLocation.lat,
              lng: c.currentLocation.lng,
              address: c.currentLocation.address || location
            }
          });
        } else {
          const coords = resolved.get(key)!;
          processedContainers.push({
            ...c,
            currentLocation: {
              lat: coords.lat,
              lng: coords.lng,
              address: coords.name
            }
          });
        }
      });

      setContainersWithLocations(processedContainers);
      setIsLoading(false);

      // Background: resolve remaining keys properly and refresh once done
      if (keys.length > FAST_LIMIT) {
        (async () => {
          const bgResolved = new Map(resolved);
          for (let i = FAST_LIMIT; i < keys.length; i += GEOCODE_BATCH) {
            const batchKeys = keys.slice(i, i + GEOCODE_BATCH);
            for (let j = 0; j < batchKeys.length; j++) {
              const key = batchKeys[j];
              const { location, depot } = uniqueKeyToLoc.get(key)!;
              const coords = await getLocationCoordinates(location, depot);
              bgResolved.set(key, coords);
              if (!HAS_GOOGLE) { await new Promise(r => setTimeout(r, 600)); }
            }
            if (HAS_GOOGLE && i + GEOCODE_BATCH < keys.length) { await new Promise(r => setTimeout(r, 80)); }
          }

          // Update only containers that used approximations
          setContainersWithLocations(prev => prev.map(c => {
            const location = c.excelMetadata?.location || 'Unknown';
            const depot = c.excelMetadata?.depot || 'Unknown';
            const key = `${location}|${depot}`.toLowerCase();
            const coords = bgResolved.get(key);
            if (!coords) return c;
            if (c.currentLocation && typeof c.currentLocation.lat === 'number' && typeof c.currentLocation.lng === 'number') return c;
            return { ...c, currentLocation: { lat: coords.lat, lng: coords.lng, address: coords.name } };
          }));
        })();
      }
    };

    processContainers();
  }, [containers]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.L || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize map with India-first view
      const initialCenter = region === 'india' ? [21.0, 78.0] : [20.0, 0.0];
      const initialZoom = region === 'india' ? 4 : 2;
      mapInstanceRef.current = window.L.map(mapRef.current).setView(initialCenter, initialZoom);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(mapInstanceRef.current);
    }

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    if (!showMarkers || containersWithLocations.length === 0) return;

    // Filter containers based on status and depot
    let filteredContainers = containersWithLocations.filter(container => {
      const statusMatch = filterStatus === "all" || 
        (container.excelMetadata?.status || container.status)?.toLowerCase() === filterStatus.toLowerCase();
      const depotMatch = filterDepot === "all" || 
        (container.excelMetadata?.depot || 'Unknown')?.toLowerCase().includes(filterDepot.toLowerCase());
      return statusMatch && depotMatch;
    });

    // Region filter (India-first by default)
    if (region === 'india') {
      filteredContainers = filteredContainers.filter(c => {
        const addr = c.currentLocation?.address?.toLowerCase() || '';
        const likelyIn = isLikelyIndia(c.excelMetadata?.location || '', c.excelMetadata?.depot || '');
        return likelyIn || addr.includes('india') || addr.includes('chennai') || addr.includes('mumbai') || addr.includes('bangalore') || addr.includes('hyderabad') || addr.includes('kolkata') || addr.includes('pune') || addr.includes('visakhapatnam');
      });
    }

    // Group containers by location for clustering
    const locationGroups: Record<string, Container[]> = {};
    filteredContainers.forEach(container => {
      const locationKey = container.currentLocation?.address || 'Unknown';
      if (!locationGroups[locationKey]) {
        locationGroups[locationKey] = [];
      }
      locationGroups[locationKey].push(container);
    });

    // Add markers for each location group
    Object.entries(locationGroups).forEach(([locationName, containersAtLocation]) => {
      const firstContainer = containersAtLocation[0];
      if (!firstContainer.currentLocation) return;

      const healthScore = firstContainer.healthScore || 0;
      const status = firstContainer.excelMetadata?.status || firstContainer.status;
      
      // Determine marker color based on status and health
      let color = "#6b7280"; // Default gray
      let statusText = "Unknown";
      
      if (status?.toUpperCase() === "DEPLOYED") {
        color = healthScore >= 80 ? "#73C8D2" : healthScore >= 60 ? "#FF9013" : "#ef4444";
        statusText = "Deployed";
      } else if (status?.toUpperCase() === "SALE") {
        color = "#0046FF";
        statusText = "For Sale";
      } else if (status?.toUpperCase() === "MAINTENANCE") {
        color = "#FF9013";
        statusText = "Maintenance";
      } else if (status?.toUpperCase() === "STORAGE") {
        color = "#73C8D2";
        statusText = "Storage";
      }

      // Calculate marker size based on number of containers at this location
      const markerSize = Math.min(8 + containersAtLocation.length * 2, 20);

      const mapMarker = window.L.circleMarker(
        [firstContainer.currentLocation.lat, firstContainer.currentLocation.lng],
        {
          radius: markerSize,
          fillColor: color,
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        }
      ).addTo(mapInstanceRef.current);

      // Create popup content
      const popupContent = `
        <div class="p-3 min-w-[250px]">
          <div class="flex items-center gap-2 mb-2">
            <span class="font-bold text-sm">${locationName}</span>
            <span class="px-2 py-1 text-xs rounded-full" style="background-color: ${color}20; color: ${color}">
              ${statusText}
            </span>
          </div>
          <div class="text-xs text-gray-600 mb-2">
            <strong>Containers:</strong> ${containersAtLocation.length}
          </div>
          <div class="space-y-1 text-xs max-h-32 overflow-y-auto">
            ${containersAtLocation.slice(0, 5).map(container => `
              <div class="flex justify-between items-center py-1 border-b border-gray-100">
                <span class="font-mono text-xs">${container.containerCode}</span>
                <span class="text-xs text-gray-500">${container.excelMetadata?.productType || container.type}</span>
              </div>
            `).join('')}
            ${containersAtLocation.length > 5 ? `<div class="text-xs text-gray-500 text-center pt-1">... and ${containersAtLocation.length - 5} more</div>` : ''}
          </div>
        </div>
      `;

      mapMarker.bindPopup(popupContent);
      markersRef.current.push(mapMarker);
    });

    // Fit map to show all markers (India-first bounds when region is india)
    if (filteredContainers.length > 0) {
      const group = new window.L.featureGroup(markersRef.current);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  }, [containersWithLocations, filterStatus, filterDepot, showMarkers, region]);

  // Get unique depots for filter
  const uniqueDepots = Array.from(new Set(
    containers.map(c => c.excelMetadata?.depot).filter(Boolean)
  ));

  // Get status counts for legend
  const statusCounts = containersWithLocations.reduce((acc, container) => {
    const status = container.excelMetadata?.status || container.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get depot counts
  const depotCounts = containersWithLocations.reduce((acc, container) => {
    const depot = container.excelMetadata?.depot || 'Unknown';
    acc[depot] = (acc[depot] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Container Fleet Map - Your Data
        </CardTitle>
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMarkers(!showMarkers)}
            className="flex items-center gap-2"
          >
            {showMarkers ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showMarkers ? 'Hide' : 'Show'} Markers
          </Button>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Status ({containersWithLocations.length})</option>
            <option value="deployed">Deployed ({statusCounts.DEPLOYED || 0})</option>
            <option value="sale">For Sale ({statusCounts.SALE || 0})</option>
            <option value="maintenance">Maintenance ({statusCounts.MAINTENANCE || 0})</option>
            <option value="storage">Storage ({statusCounts.STORAGE || 0})</option>
          </select>

          <select
            value={filterDepot}
            onChange={(e) => setFilterDepot(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Depots ({containersWithLocations.length})</option>
            {uniqueDepots.map(depot => (
              <option key={depot} value={depot?.toLowerCase() || 'unknown'}>
                {depot} ({depotCounts[depot || 'Unknown'] || 0})
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center gap-2">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as 'india' | 'global')}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="india">Focus: India</option>
            <option value="global">Focus: Global</option>
          </select>
        </div>
        {isLoading && (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading container locations globally...</p>
            </div>
          </div>
        )}
        
        <div ref={mapRef} className="w-full h-96 rounded-lg border" />
        
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-muted-foreground">Deployed ({statusCounts.DEPLOYED || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-muted-foreground">For Sale ({statusCounts.SALE || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-muted-foreground">Maintenance ({statusCounts.MAINTENANCE || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="text-muted-foreground">Storage ({statusCounts.STORAGE || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span className="text-muted-foreground">Unknown ({statusCounts.unknown || 0})</span>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <p>📍 Locations mapped from your actual container data (Location & Depot fields).</p>
            <p>🏭 Nicon Marine & Zircon locations mapped to Chennai Port & Ennore Port respectively.</p>
            <p>🔍 Marker size indicates number of containers at each location.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
